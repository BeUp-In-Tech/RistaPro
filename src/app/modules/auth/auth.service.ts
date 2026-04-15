/* eslint-disable @typescript-eslint/no-explicit-any */
import { StatusCodes } from 'http-status-codes';
import AppError from '../../errorHelpers/AppError';
import User from '../user/user.model';
import bcrypt from 'bcrypt';
import { ActiveStatus, Role } from '../user/user.interface';
import env from '../../config/env';
import { randomOTPGenerator } from '../../utils/randomOTPGenerator';
import { redisClient } from '../../config/redis.config';
import { SendEmailOptions } from '../../utils/sendMail';
import jwt from 'jsonwebtoken';
import { SignOptions } from 'jsonwebtoken';
import { JwtPayload } from 'jsonwebtoken';
import { createUserTokens } from '../../utils/user.tokens';
import { verifyToken } from '../../utils/jwt';
import { sendMailByBullMQ } from '../../utils/backgroundJobProcessingHelper';
import { GoogleIdTokenPayload, GoogleUserInfoPayload } from './auth.interface';
import axios from 'axios';
import { createRemoteJWKSet, jwtVerify } from 'jose';


// GOOGLE AUTH FOR MOBILE DEVICES
const googleJWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs')
);

const buildGoogleAllowedClientIds = () => {
  const rawClientIds = [`${env.GOOGLE_ANDROID_CLIENT_ID},${env.GOOGLE_IOS_CLIENT_ID}`]
    .join(',')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

 

  return new Set(rawClientIds);
};

const googleAuthSystem = async (payload: any) => {
  if (!payload || typeof payload !== 'object') {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid Google auth payload');
  }

  const idToken =
    typeof payload?.id_token === 'string' ? payload.id_token.trim() : '';
  const accessToken =
    typeof payload?.access_token === 'string' ? payload.access_token.trim() : '';

  if (!idToken) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Google id_token is required');
  }

  const googleAllowedClientIds = buildGoogleAllowedClientIds();
  // const googleAllowedClientIds: string[] = [env.GOOGLE_ANDROID_CLIENT_ID, env.GOOGLE_IOS_CLIENT_ID, env.GOOGLE_WEB_CLIENT_ID as string];

  if (!googleAllowedClientIds.size ) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Google OAuth client ids are not configured'
    );
  }

  let verifiedGooglePayload: GoogleIdTokenPayload;
  try {
    const { payload: verifiedPayload } = await jwtVerify(idToken, googleJWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
    });

    verifiedGooglePayload = verifiedPayload as GoogleIdTokenPayload;
  } catch (error: any) {
    const reason =
      env.NODE_ENV === 'development' && error?.message
        ? `: ${error.message}`
        : '';

    throw new AppError(
      StatusCodes.UNAUTHORIZED,
      `Invalid Google id_token${reason}`
    );
  }

  const audienceList = Array.isArray(verifiedGooglePayload.aud)
    ? verifiedGooglePayload.aud
        .map((aud) => (typeof aud === 'string' ? aud.trim() : ''))
        .filter(Boolean)
    : typeof verifiedGooglePayload.aud === 'string'
      ? [verifiedGooglePayload.aud.trim()].filter(Boolean)
      : [];
  const azp =
    typeof verifiedGooglePayload.azp === 'string'
      ? verifiedGooglePayload.azp.trim()
      : '';

  const audienceMatched = audienceList.some((aud) =>
    googleAllowedClientIds.has(aud)
  );
  const azpMatched = azp ? googleAllowedClientIds.has(azp) : false;

  if (!audienceMatched && !azpMatched) {
    const reason =
      env.NODE_ENV === 'development'
        ? ` | aud=${audienceList.join(',') || 'N/A'} | azp=${azp || 'N/A'} | allowed=${Array.from(googleAllowedClientIds).join(',')}`
        : '';

    throw new AppError(
      StatusCodes.UNAUTHORIZED,
      `Google id_token audience mismatch${reason}`
    );
  }

  const googleUserId =
    typeof verifiedGooglePayload.sub === 'string'
      ? verifiedGooglePayload.sub.trim()
      : '';
  const verifiedEmail =
    typeof verifiedGooglePayload.email === 'string'
      ? verifiedGooglePayload.email.toLowerCase().trim()
      : '';

  if (!googleUserId) {
    throw new AppError(
      StatusCodes.UNAUTHORIZED,
      'Google user id not found in token'
    );
  }

  if (!verifiedEmail || verifiedGooglePayload.email_verified !== true) {
    throw new AppError(
      StatusCodes.UNAUTHORIZED,
      'Google email is not verified'
    );
  }

  const requestEmail =
    typeof payload?.email === 'string' ? payload.email.toLowerCase().trim() : '';
  if (requestEmail && requestEmail !== verifiedEmail) {
    throw new AppError(StatusCodes.UNAUTHORIZED, 'Google payload email mismatch');
  }

  if (accessToken) {
    try {
      const { data: googleUserInfo } = await axios.get<GoogleUserInfoPayload>(
        'https://openidconnect.googleapis.com/v1/userinfo',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const accessTokenSub =
        typeof googleUserInfo?.sub === 'string'
          ? googleUserInfo.sub.trim()
          : '';
      const accessTokenEmail =
        typeof googleUserInfo?.email === 'string'
          ? googleUserInfo.email.toLowerCase().trim()
          : '';

      if (!accessTokenSub || accessTokenSub !== googleUserId) {
        throw new AppError(StatusCodes.UNAUTHORIZED, 'Google token mismatch');
      }

      if (accessTokenEmail && accessTokenEmail !== verifiedEmail) {
        throw new AppError(
          StatusCodes.UNAUTHORIZED,
          'Google token email mismatch'
        );
      }

      if (googleUserInfo.email_verified === false) {
        throw new AppError(
          StatusCodes.UNAUTHORIZED,
          'Google access token email is not verified'
        );
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        throw new AppError(
          StatusCodes.UNAUTHORIZED,
          'Google access_token validation failed'
        );
      }

      throw error;
    }
  }

  const fallbackName = verifiedEmail.split('@')[0] || 'Google User';
  const providerName =
    typeof verifiedGooglePayload.name === 'string'
      ? verifiedGooglePayload.name.trim()
      : '';
  const requestName =
    typeof payload?.name === 'string' ? payload.name.trim() : '';
  const userName = providerName || requestName || fallbackName;

  let user = null;
  try {
    user = await User.findOneAndUpdate(
      {
        email: verifiedEmail,
        $or: [
          { auths: { $not: { $elemMatch: { provider: 'google' } } } },
          { auths: { $elemMatch: { provider: 'google', providerId: googleUserId } } },
        ],
      },
      {
        $set: {
          isVerified: true,
        },
        $addToSet: {
          auths: {
            provider: 'google',
            providerId: googleUserId,
          },
        },
        $setOnInsert: {
          user_name: userName,
          email: verifiedEmail,
          role: Role.USER,
        },
      },
      { upsert: true, new: true }
    );
  } catch (error: any) {
    if (error?.code === 11000) {
      throw new AppError(
        StatusCodes.UNAUTHORIZED,
        'Google account mismatch for this email'
      );
    }
    throw error;
  }

  if (!user) {
    throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, 'Authentication failed');
  }

  if (user.isDeleted) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'User was deleted!');
  }

  if (
    user.isActive === ActiveStatus.INACTIVE ||
    user.isActive === ActiveStatus.BLOCKED
  ) {
    throw new AppError(StatusCodes.BAD_REQUEST, `User is ${user.isActive}`);
  }

  const userTokens = await createUserTokens({
    _id: user._id,
    email: user.email,
    role: user.role,
  } as JwtPayload);

  return {
    accessToken: userTokens.accessToken,
    refreshToken: userTokens.refreshToken,
  };
};



// CHANGE PASSWORD
const changePasswordService = async (
  userId: string,
  oldPassword: string,
  newPassword: string
) => {
  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw new AppError(StatusCodes.NOT_FOUND, 'User not found!');
  }

  if (!oldPassword) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Please provide your old password!'
    );
  }

  if (!newPassword) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Please provide your new password!'
    );
  }

  const matchPassword = await bcrypt.compare(
    oldPassword,
    user.password as string
  );
  if (!matchPassword) {
    throw new AppError(StatusCodes.BAD_REQUEST, "Password doesn't matched!");
  }

  //   console.log(newPassword);

  user.password = newPassword;
  await user.save();

  return null;
};

// FORGET PASSWORD
const forgetPasswordService = async (email: string) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError(StatusCodes.NOT_FOUND, 'User not found!');
  }

  if (user.isDeleted) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'User was deleted!');
  }

  if (
    user.isActive === ActiveStatus.INACTIVE ||
    user.isActive === ActiveStatus.BLOCKED
  ) {
    throw new AppError(StatusCodes.BAD_REQUEST, `User is ${user.isActive}`);
  }

  const otp = randomOTPGenerator(100000, 999999).toString(); // Generate OTP
  const hashedOTP = await bcrypt.hash(otp, Number(env.BCRYPT_SALT_ROUND)); // Hashed OTP

  // CACHED OTP TO REDIS
  await redisClient.set(`otp:${user.email}`, hashedOTP, { EX: 120 }); // 2 min

  // SENDING OTP TO EMAIL
  const emailPayload: SendEmailOptions = {
    to: user.email,
    subject: 'RistaPro:Password Reset OTP',
    templateName: 'forgetPassword_otp_send',
    templateData: {
      name: user.full_name,
      expirationTime: 2,
      otp,
    },
  }
  
  await sendMailByBullMQ(emailPayload, user._id.toString());


  return null;
};

// VERIFY RESET PASSWORD OTP
const verifyForgetPasswordOTPService = async (email: string, otp: string) => {
  if (!email) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Email required!');
  }

  // CHECK USER
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError(StatusCodes.NOT_FOUND, 'No user found!');
  }

  if (!otp || otp.length < 6) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Wrong OTP!');
  }

  // OTP MATCHING PART
  const getOTP = await redisClient.get(`otp:${email}`);

  if (!getOTP) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'OTP has expired!');
  }

  // Matching otp
  const isOTPMatched = await bcrypt.compare(otp, getOTP); // COMPARE WITH OTP
  if (!isOTPMatched) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'OTP is not matched!');
  }

  const jwtPayload = { email, verified: true };
  const jwtToken = jwt.sign(jwtPayload, env.OTP_JWT_ACCESS_SECRET, {
    expiresIn: env.OTP_JWT_ACCESS_EXPIRATION,
  } as SignOptions);

  // DELETED OTP AFTER USED
  await redisClient.del(`otp:${email}`);
  return jwtToken;
};

// RESET PASSWORD
const resetPasswordService = async (token: string, newPassword: string) => {
  if (!token) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Token must required!');
  }

  const decodedToken  = jwt.verify(
    token,
    env.OTP_JWT_ACCESS_SECRET
  ) as JwtPayload;

  if (!decodedToken ) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid token or expired!');
  }

  if (!decodedToken ?.verified) {
    throw new AppError(StatusCodes.BAD_REQUEST, "OTP wasn't verified  yet");
  }

  // CHECK USER
  const user = await User.findOne({ email: decodedToken ?.email });
  if (!user) {
    throw new AppError(StatusCodes.NOT_FOUND, 'No user found!');
  }

  // SET NEW PASSWORD
  user.password = newPassword;
  await user.save();

  return null;
};

// GET NEW ACCESS TOKEN
const getNewAccessTokenService = async (refreshToken: string) => {
  if (!refreshToken) {
    throw new AppError(StatusCodes.UNAUTHORIZED, 'Refresh token needed!');
  }

  const tokenVerify = verifyToken(
    refreshToken,
    env.JWT_REFRESH_SECRET
  ) as JwtPayload; // VERIFY TOKEN
  const isUserExists = await User.findById(tokenVerify.userId as string); // FIND USER BY ID

  if (!isUserExists) {
    throw new AppError(StatusCodes.BAD_REQUEST, "User Doesn't Exist");
  }

  if (
    isUserExists.isActive === ActiveStatus.BLOCKED ||
    isUserExists.isActive === ActiveStatus.INACTIVE
  ) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'The User "blocked" or "inactive"'
    );
  }

  if (isUserExists.isDeleted) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'The user was "deleted"');
  }

  const jwtPayload = {
    _id: isUserExists?._id,
    email: isUserExists?.email,
    role: isUserExists?.role,
  };

  const userToken = await createUserTokens(jwtPayload); // Jsonwebtoken

  return {
    newAccessToken: userToken.accessToken,
    newRefreshToken: userToken.refreshToken,
  };
};

export const authServices = {
  changePasswordService,
  forgetPasswordService,
  verifyForgetPasswordOTPService,
  resetPasswordService,
  getNewAccessTokenService,
  googleAuthSystem
};
