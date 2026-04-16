/* eslint-disable no-console */
import bcrypt from 'bcrypt';
import { StatusCodes } from 'http-status-codes';
import env from '../../config/env';
import { redisClient } from '../../config/redis.config';
import AppError from '../../errorHelpers/AppError';
import { ensureNotificationPreference } from '../notification/notification.service';
import { randomOTPGenerator } from '../../utils/randomOTPGenerator';
import { removeTokenFromOtherUsers } from '../../utils/removeTokens';
import User from './user.model';
import {
  ActiveStatus,
  IAdminUpdateUserPayload,
  ICreateConsultantPayload,
  IFcmToken,
  IUpdateProfilePayload,
  Role,
} from './user.interface';
import { QueryBuilder } from './../../utils/QueryBuilder';
import { excludeField } from './user.constant';
import { sortObject } from '../../utils/sortQueryObject';
import crypto from 'crypto';
import { invalidateAllMachineryCache } from '../../utils/dynamicCacheInvalidator';
import { deleteImageByBullMQ, sendMailByBullMQ } from '../../utils/backgroundJobProcessingHelper';


// REUSABLE KEYS
const USER_VERIFY_OTP_PREFIX = 'verify_otp:';
const USER_LIST_SELECT =
  '_id full_name email picture plan isVerified isActive role createdAt updatedAt';
const USER_DETAILS_SELECT =
  '_id full_name email picture plan isVerified isActive role createdAt updatedAt';


// =========================================API LAYER (ADMIN)=========================================
// 1. ADMIN CREATE CONSULTANT (Check Done)
const createConsultant = async (payload: ICreateConsultantPayload) => {
  const normalizedEmail = payload.email.trim().toLowerCase();
  const isUserExists = await User.exists({ email: normalizedEmail });

  if (isUserExists) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'User already exists with this email'
    );
  }

  // CREATE CONSULTANT
  const createdConsultant = await User.create({
    full_name: payload.full_name.trim(),
    email: normalizedEmail,
    password: payload.password,
    isVerified: true,
    isActive: ActiveStatus.ACTIVE,
    role: Role.CONSULTANT,
    auths: [
      {
        provider: 'credentials',
        providerId: normalizedEmail,
      },
    ],
    deviceTokens: [],
  });

  // CREATE CONSULTANT NOTIFICATION PREFERENCE
  await ensureNotificationPreference(
    createdConsultant._id.toString(),
    Role.CONSULTANT
  );


  // CACHE INVALIDATION
  await invalidateAllMachineryCache(`user_list:admin=*`);
  await redisClient.del(`get_me:${createdConsultant._id.toString()}`)


  // RETURN RESPONSE
  return createdConsultant;
};

// 2. ADMIN LIST USERS (Check Done)
const getUsers = async (query: Record<string, string>) => {
  // SORT OBJECT
  const sortedParams = sortObject(query);
  const hashKey = `user_list:admin=${crypto.createHash('md5').update(JSON.stringify(sortedParams)).digest('hex')}`;
  
  // CACHED RESPONSE
  const checkedData = await redisClient.get(hashKey);
  if (checkedData) {
    return JSON.parse(checkedData);
  }


  // DB QUERY
  const queryBuilder = new QueryBuilder(User.find(), query);
  const users = await queryBuilder
    .filter(excludeField)
    .select()
    .search(['full_name', 'email'])
    .sort()
    .paginate()
    .build();

  // Remove exclude field
  const filter = { ...query };
  for (const value of excludeField) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete filter[value];
  }

  // TOTAL COUNT
  const total = await User.countDocuments(filter);
  const { page, limit } = await queryBuilder.getMeta();

  // META OPTIONS
  const meta = {
    total,
    page,
    limit,
    totalPage: total === 0 ? 0 : Math.ceil(total / limit),
  };

  // DATA
  const final_data =  {
    meta,
    data: users,
  };


  // DATA CACHED IN REDIS
  await redisClient.set(hashKey, JSON.stringify(final_data), {
    EX: 60 * 60, // 1 HOUR
  });
  
  // RETURN DATA
  return final_data;
};

// 3. ADMIN GET SINGLE USER (Check Done)
const getUserById = async (userId: string) => {
  const user = await User.findOne({ _id: userId, isDeleted: false })
    .select(USER_DETAILS_SELECT)
    .lean();

  if (!user) {
    throw new AppError(StatusCodes.NOT_FOUND, 'User not found');
  }

  return user;
};

// 4. ADMIN UPDATE USER (Check Done)
const updateUserByAdmin = async (
  userId: string,
  payload: IAdminUpdateUserPayload
) => {
  // CHECK EXISTING USER
  const existingUser = await User.findOne({
    _id: userId,
    isDeleted: false,
  })
    .select('picture')
    .lean();

  if (!existingUser) {
    throw new AppError(StatusCodes.NOT_FOUND, 'User not found');
  }

  const updatePayload: IAdminUpdateUserPayload = {};

  if (payload.full_name !== undefined) {
    updatePayload.full_name = payload.full_name.trim();
  }

  if (payload.picture !== undefined) {
    updatePayload.picture = payload.picture.trim();
  }

  if (payload.plan !== undefined) {
    updatePayload.plan = payload.plan.trim();
  }

  if (payload.isVerified !== undefined) {
    updatePayload.isVerified = payload.isVerified;
  }

  if (payload.isActive !== undefined) {
    updatePayload.isActive = payload.isActive;
  }

  if (payload.isDeleted !== undefined) {
    updatePayload.isDeleted = payload.isDeleted;
  }

  if (Object.keys(updatePayload).length === 0) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'At least one valid field is required to update'
    );
  }

  // UPDATE USER
  const updatedUser = await User.findOneAndUpdate(
    { _id: userId, isDeleted: false },
    updatePayload,
    {
      new: true,
      runValidators: true,
    }
  )
    .select(USER_DETAILS_SELECT)
    .lean();

  if (!updatedUser) {
    throw new AppError(StatusCodes.NOT_FOUND, 'User not found');
  }

  // DELETE PREVIOUS PICTURE
  if (payload.picture && existingUser.picture) {
     const jobId = `delete_image_${Date.now()}_${userId}`;
     await deleteImageByBullMQ([existingUser.picture as string], jobId);
   }


  // CACHE INVALIDATION
  await invalidateAllMachineryCache(`user_list:admin=*`);
  await redisClient.del(`get_me:${userId}`);

  // RETURN RESPONSE
  return updatedUser;
};

// 5. ADMIN SOFT DELETE USER (Check Done)
const deleteUser = async (authUserId: string, targetUserId: string) => {
  if (authUserId === targetUserId) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'You cannot delete your own account from this endpoint'
    );
  }

  const deletedUser = await User.findOneAndUpdate(
    { _id: targetUserId, isDeleted: false },
    {
      isDeleted: true,
      isActive: ActiveStatus.INACTIVE,
      deviceTokens: [],
    },
    {
      new: true,
      runValidators: true,
    }
  )
    .select(USER_LIST_SELECT)
    .lean();

  if (!deletedUser) {
    throw new AppError(StatusCodes.NOT_FOUND, 'User not found');
  }


  // CACHE INVALIDATION
  await invalidateAllMachineryCache(`user_list:admin=*`);


  // RETURN RESPONSE
  return null;
};


// ============================ USER PART ================================
// 6. AUTH USER PROFILE (Check Done)
const getMe = async (userId: string) => {
  // REDIS CACHE
  const cacheKey = `get_me:${userId}`;
  const cachedData = await redisClient.get(cacheKey);
  if (cachedData) {
    return JSON.parse(cachedData);
  }
  
  // DB QUERY
  const user = await User.findOne({ _id: userId, isDeleted: false })
    .select('-deviceTokens -auths -password')
    .lean();

  if (!user) {
    throw new AppError(StatusCodes.NOT_FOUND, 'User not found');
  }


  // STORE DATA IN REDIS
  await redisClient.set(cacheKey, JSON.stringify(user), {
    EX: 60 * 2, // 2 min
  });

  // RETURN RESPONSE
  return user;
};

// 7. AUTH USER PROFILE UPDATE (Check Done)
const updateMyProfile = async (
  userId: string,
  payload: IUpdateProfilePayload
) => {
  const updatePayload: IUpdateProfilePayload = {};

  if (payload.full_name !== undefined) {
    updatePayload.full_name = payload.full_name.trim();
  }

  if (payload.picture !== undefined) {
    updatePayload.picture = payload.picture.trim();
  }

  if (Object.keys(updatePayload).length === 0) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'At least one valid field is required to update'
    );
  }

  // GET EXISTING USER
  const existingUser = await User.findOne({
    _id: userId,
    isDeleted: false,
  })
    .select('picture')
    .lean();

  if (!existingUser) {
    throw new AppError(StatusCodes.NOT_FOUND, 'User not found');
  }

  // UPDATE USER
  const updatedUser = await User.findOneAndUpdate(
    { _id: userId, isDeleted: false },
    updatePayload,
    {
      new: true,
      runValidators: true,
    }
  )
    .select(USER_DETAILS_SELECT)
    .lean();

  if (!updatedUser) {
    throw new AppError(StatusCodes.NOT_FOUND, 'User not found');
  }

  // DELETE PREVIOUS PICTURE
  if (payload.picture) {
    const jobId = `delete_image_${new Date()}`
    await deleteImageByBullMQ([existingUser.picture as string], jobId);
  }



  // CACHE INVALIDATION
  await invalidateAllMachineryCache(`user_list:admin=*`);
  await redisClient.del(`get_me:${userId}`);

  // RETURN UPDATE USER
  return updatedUser;
};

// 8. AUTH USER SEND VERIFICATION OTP
const sendVerificationOtp = async (userId: string) => {
  const user = await User.findOne({ _id: userId, isDeleted: false })
    .select('full_name email isVerified')
    .lean();

  if (!user) {
    throw new AppError(StatusCodes.NOT_FOUND, 'User not found');
  }

  if (user.isVerified) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'User profile is already verified'
    );
  }

  const otp = randomOTPGenerator(100000, 999999).toString();
  const hashedOtp = await bcrypt.hash(otp, Number(env.BCRYPT_SALT_ROUND));

  await redisClient.set(`${USER_VERIFY_OTP_PREFIX}${userId}`, hashedOtp, {
    EX: 5 * 60,
  });


  /*
  
  ==============================================

  SMS OTP SENDING LOGIC SHOULD BE HANDLED HERE
  ===============================================

  */
   

  return "Twilio OTP sending should be implemented here";
};

// 9. AUTH USER VERIFY PROFILE
const verifyMyProfile = async (userId: string, otp: string) => {
  const user = await User.findOne({ _id: userId, isDeleted: false });

  if (!user) {
    throw new AppError(StatusCodes.NOT_FOUND, 'User not found');
  }

  if (user.isVerified) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'User profile is already verified'
    );
  }

  const storedOtp = await redisClient.get(`${USER_VERIFY_OTP_PREFIX}${userId}`);

  if (!storedOtp) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'OTP has expired or was not requested'
    );
  }

  const isOtpMatched = await bcrypt.compare(otp, storedOtp);

  if (!isOtpMatched) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid OTP');
  }

  user.isVerified = true;
  await user.save();

  // CACHE INVALIDATION
  await redisClient.del(`${USER_VERIFY_OTP_PREFIX}${userId}`);
  await invalidateAllMachineryCache(`user_list:admin=*`);
  await redisClient.del(`get_me:${userId}`);

  // SEND GREETINGS MAIL
  await sendMailByBullMQ({
    to: user.email,
    subject: "Welcome to RistaPro",
    templateName: "greetings",
    templateData: {
      name: user.full_name,
      profileUrl: `${env.FRONTEND_URL}/profile`,
      privacyPolicy: `${env.FRONTEND_URL}/privacy-policy`,
      termsOfService: `${env.FRONTEND_URL}/terms-of-service`
    }
  }, `greetings_${userId}`);

  // RETURN UPDATE USER
  return null;
};

// 10. AUTH USER REGISTER DEVICE TOKEN (Check Done)
const registerPushToken = async (userId: string, payload: IFcmToken) => {
  const token = payload.token.trim();
  const deviceId = payload.deviceId.trim();
  const deviceName = payload.deviceName?.trim() || '';
  const now = new Date();

  const removedTokenResult = await removeTokenFromOtherUsers(token, userId);

  if (removedTokenResult.removedCount > 0) {
    console.warn('[push-token] token moved from another user', {
      currentUserId: userId,
      removedFromUserIds: removedTokenResult.removedFromUserIds,
      removedCount: removedTokenResult.removedCount,
    });
  }

  const registerResult = await User.updateOne(
    { _id: userId, isDeleted: false },
    [
      {
        $set: {
          deviceTokens: {
            $concatArrays: [
              {
                $filter: {
                  input: { $ifNull: ['$deviceTokens', []] },
                  as: 'device',
                  cond: {
                    $and: [
                      { $ne: ['$$device.deviceId', deviceId] },
                      { $ne: ['$$device.token', token] },
                    ],
                  },
                },
              },
              [
                {
                  token,
                  platform: payload.platform,
                  deviceId,
                  deviceName,
                  lastSeenAt: now,
                  isActive: true,
                },
              ],
            ],
          },
          updatedAt: now,
        },
      },
    ]
  );

  if (registerResult.matchedCount === 0) {
    throw new AppError(StatusCodes.NOT_FOUND, 'User not found');
  }

  return null;
};

// 11. AUTH USER UNREGISTER DEVICE TOKEN (Check Done)
const unregisterPushToken = async (userId: string, deviceId: string) => {
  const updateResult = await User.updateOne(
    { _id: userId, isDeleted: false, 'deviceTokens.deviceId': deviceId },
    {
      $set: {
        'deviceTokens.$.isActive': false,
        'deviceTokens.$.lastSeenAt': new Date(),
      },
    }
  );

  if (updateResult.matchedCount === 0) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Device not found');
  }

  return null;
};

// 12. AUTH USER LIST DEVICES
const listMyDevices = async (userId: string) => {
  const user = await User.findOne({ _id: userId, isDeleted: false })
    .select('deviceTokens')
    .lean();

  if (!user) {
    throw new AppError(StatusCodes.NOT_FOUND, 'User not found');
  }

  return [...(user.deviceTokens ?? [])].sort((firstDevice, secondDevice) => {
    const activeCompare =
      Number(secondDevice.isActive ?? false) -
      Number(firstDevice.isActive ?? false);

    if (activeCompare !== 0) {
      return activeCompare;
    }

    return (
      new Date(secondDevice.lastSeenAt ?? 0).getTime() -
      new Date(firstDevice.lastSeenAt ?? 0).getTime()
    );
  });
};

export const UserService = {
  createConsultant,
  getUsers,
  getUserById,
  updateUserByAdmin,
  deleteUser,
  getMe,
  updateMyProfile,
  sendVerificationOtp,
  verifyMyProfile,
  registerPushToken,
  unregisterPushToken,
  listMyDevices,
};
