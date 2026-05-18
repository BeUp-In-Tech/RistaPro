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
import Candidate from '../candidate/candidate.model';
import {
  CandidateLinkedUserAccessRole,
  CandidateLinkedUserStatus,
  TActiveLinkedUserLean,
} from '../candidate/linked-user/candidateLinkedUser.interface';
import CandidateLinkedUser from '../candidate/linked-user/candidateLinkedUser.model';
import { buildMyAccessResponse } from '../candidate/linked-user/candidateLinkedUser.helper';
import { PLAN_KEYS, PlanKey, IPlan } from '../plan/plan.interface';
import { PLANS } from '../plan/plan.constant';
import PlanModel from '../plan/plan.model';
import { getActiveCandidateAccessesForUser } from '../candidate/linked-user/candidateLinkedUser.access';
import { buildSwipeQuotaResponse } from '../swipe/swipe.helper';
import { ISwipeActionResponse } from '../swipe/swipe.interface';


// REUSABLE KEYS
const USER_VERIFY_OTP_PREFIX = 'verify_otp:';
const USER_LIST_SELECT =
  '_id full_name email picture isVerified isActive role createdAt updatedAt';
const USER_DETAILS_SELECT =
  '_id full_name email picture isVerified isActive role createdAt updatedAt';
const AUTH_USER_CONTEXT_SELECT =
  '_id full_name email picture isVerified isActive role createdAt updatedAt';
const BASIC_CANDIDATE_CONTEXT_SELECT = '_id plan';


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

  const planByUserId = await getPlanByUserIds(
    users.map((user) => String(user._id))
  );

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
    data: users.map((user) => ({
      ...user,
      plan: planByUserId.get(String(user._id)) ?? 'free',
    })),
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

  return {
    ...user,
    plan: await getActiveCandidatePlanForUser(userId),
  };
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
    if (!PLAN_KEYS.includes(payload.plan)) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid plan type');
    }

    await setCandidatePlanForUser(userId, payload.plan);
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

  if (Object.keys(updatePayload).length === 0 && payload.plan === undefined) {
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
  return {
    ...updatedUser,
    plan: await getActiveCandidatePlanForUser(userId),
  };
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
const getPlanKeyOrDefault = (plan?: string): PlanKey => {
  return PLAN_KEYS.includes(plan as PlanKey) ? (plan as PlanKey) : 'free';
};

const getCurrentPlanOrDefault = async (plan?: string) => {
  const planKey = getPlanKeyOrDefault(plan);
  const planDocument = await PlanModel.findOne({
    isActive: true,
    key: planKey,
  }).lean<IPlan | null>();

  return {
    ...PLANS[planKey],
    ...(planDocument ?? {}),
  };
};

const getPlanByUserIds = async (userIds: string[]) => {
  if (!userIds.length) {
    return new Map<string, PlanKey>();
  }

  const [linkedCandidates, legacyCandidates] = await Promise.all([
    CandidateLinkedUser.find({
      status: CandidateLinkedUserStatus.ACTIVE,
      user: { $in: userIds },
    })
      .populate({
        path: 'candidate',
        select: '_id plan',
      })
      .select('user candidate')
      .lean<
        {
          user: unknown;
          candidate: { _id: unknown; plan?: PlanKey } | null;
        }[]
      >(),
    Candidate.find({
      isActive: ActiveStatus.ACTIVE,
      user: { $in: userIds },
    })
      .select('_id user plan')
      .lean<{ _id: unknown; user: unknown; plan?: PlanKey }[]>(),
  ]);

  const planByUserId = new Map<string, PlanKey>();

  for (const linkedCandidate of linkedCandidates) {
    if (!linkedCandidate.candidate) {
      continue;
    }

    planByUserId.set(
      String(linkedCandidate.user),
      getPlanKeyOrDefault(linkedCandidate.candidate.plan)
    );
  }

  for (const legacyCandidate of legacyCandidates) {
    const candidateUserId = String(legacyCandidate.user);

    if (!planByUserId.has(candidateUserId)) {
      planByUserId.set(
        candidateUserId,
        getPlanKeyOrDefault(legacyCandidate.plan)
      );
    }
  }

  return planByUserId;
};

const getActiveCandidatePlanForUser = async (userId: string) => {
  const planByUserId = await getPlanByUserIds([userId]);
  return planByUserId.get(userId) ?? 'free';
};

// Delete candidate plan cache.
const clearCandidatePlanCaches = async (candidateId: string) => {
  const affectedUserIds = await CandidateLinkedUser.find({
    candidate: candidateId,
    status: CandidateLinkedUserStatus.ACTIVE,
  })
    .select('user')
    .lean<{ user: unknown }[]>();

  await Promise.all(
    affectedUserIds.map((linkedUser) =>
      redisClient.del(`get_me:${String(linkedUser.user)}`)
    )
  );
};

const setCandidatePlanForUser = async (userId: string, plan: PlanKey) => {
  const activeCandidateAccesses = await getActiveCandidateAccessesForUser(userId);

  if (!activeCandidateAccesses.length) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'No active candidate profile found for this user to assign a plan'
    );
  }

  if (activeCandidateAccesses.length > 1) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'This user is linked to multiple active candidate profiles. Resolve that before updating the plan'
    );
  }

  const candidateId = activeCandidateAccesses[0].candidateId;
  const updatedCandidate = await Candidate.findOneAndUpdate(
    { _id: candidateId, isActive: ActiveStatus.ACTIVE },
    { $set: { plan } },
    {
      new: true,
      runValidators: true,
    }
  )
    .select('_id')
    .lean<{ _id: unknown } | null>();

  if (!updatedCandidate) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Candidate profile not found');
  }

  await clearCandidatePlanCaches(candidateId);
};

const getCandidateLinkContext = async (userId: string) => {
  const linkedCandidate = await CandidateLinkedUser.findOne({
    status: CandidateLinkedUserStatus.ACTIVE,
    user: userId,
  })
    .populate({
      path: 'candidate',
      select: BASIC_CANDIDATE_CONTEXT_SELECT,
    })
    .lean<
      (TActiveLinkedUserLean & {
        candidate: { _id: unknown; plan?: PlanKey } | null;
      }) | null
    >();

  if (linkedCandidate?.candidate) {
    return {
      isLinked: true,
      source: 'LINKED_USER',
      candidateId: linkedCandidate.candidate._id,
      plan: getPlanKeyOrDefault(linkedCandidate.candidate.plan),
      myAccess: buildMyAccessResponse(linkedCandidate),
    };
  }

  const legacyCandidate = await Candidate.findOne({
    isActive: ActiveStatus.ACTIVE,
    user: userId,
  })
    .select(BASIC_CANDIDATE_CONTEXT_SELECT)
    .lean<{
      _id: unknown;
      plan?: PlanKey;
    } | null>();

  if (!legacyCandidate) {
    return {
      isLinked: false,
      source: null,
      candidateId: null,
      plan: 'free' as PlanKey,
      myAccess: null,
    };
  }

  return {
    isLinked: true,
    source: 'LEGACY_OWNER',
    candidateId: legacyCandidate._id,
    plan: getPlanKeyOrDefault(legacyCandidate.plan),
    myAccess: {
      accessRole: CandidateLinkedUserAccessRole.OWNER,
      relationshipToCandidate: 'SELF',
      status: CandidateLinkedUserStatus.ACTIVE,
      isPrimary: true,
    },
  };
};

// 6. AUTH USER PROFILE (Check Done)
const getMe = async (userId: string) => {
  // DB QUERY
  const user = await User.findOne({ _id: userId, isDeleted: false })
    .select(AUTH_USER_CONTEXT_SELECT)
    .lean();

    if (!user) {
      throw new AppError(StatusCodes.NOT_FOUND, 'User not found');
    }
    
  const candidateLink = await getCandidateLinkContext(userId);
  const currentPlan = await getCurrentPlanOrDefault(candidateLink.plan);

  const isEditorOrOwner =
    candidateLink.myAccess?.accessRole === CandidateLinkedUserAccessRole.OWNER ||
    candidateLink.myAccess?.accessRole === CandidateLinkedUserAccessRole.EDITOR;

  let quota: ISwipeActionResponse['quota'] | null = null;
  if (candidateLink.isLinked && candidateLink.candidateId) {
    quota = await buildSwipeQuotaResponse({
      candidateId: String(candidateLink.candidateId),
      plan: {
        dailyLikes: currentPlan.dailyLikes,
        superLikes: currentPlan.superLikes,
      },
    });
  }

  return {
    _id: user._id,
    full_name: user.full_name,
    email: user.email,
    picture: user.picture,
    plan: candidateLink.plan,
    isVerified: user.isVerified,
    isActive: user.isActive,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    candidateLink,
    quota,
    permissions: {
      canViewSwipeFeed: candidateLink.isLinked,
      canPerformSwipeAction: candidateLink.isLinked && isEditorOrOwner,
      canUseNormalLike: candidateLink.isLinked && isEditorOrOwner,
      canUseSuperLike:
        candidateLink.isLinked && isEditorOrOwner && currentPlan.superLikes > 0,
      canSeeWhoLiked: currentPlan.canSeeWhoLiked,
      canMessage: currentPlan.canMessage,
      canAudioCall: currentPlan.canAudioCall,
      canVideoCall: currentPlan.canVideoCall,
      canViewFullProfile: currentPlan.canViewFullProfile,
      profileBoost: currentPlan.profileBoost,
    },
  };
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
  return {
    ...updatedUser,
    plan: await getActiveCandidatePlanForUser(userId),
  };
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
const templateData = {
    otp: otp,
    name: user.full_name,
    expirationTime: '5 minutes',
  };

 // SEND GREETINGS MAIL
  await sendMailByBullMQ({
    to: user.email,
    subject: "Welcome to RishtaPro",
    templateName: "otp_test_email",
    templateData: templateData
  }, `greetings_${userId}`);

   

  return  null;
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
    subject: "Welcome to RishtaPro",
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
