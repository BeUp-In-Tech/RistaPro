/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextFunction, Request, Response } from 'express';
import { CatchAsync } from '../../utils/CatchAsync';
import passport from 'passport';
import AppError from '../../errorHelpers/AppError';
import httpStatus, { StatusCodes } from 'http-status-codes';
import { SetCookies } from '../../utils/setCookie';
import { createUserTokens } from '../../utils/user.tokens';
import { JwtPayload } from 'jsonwebtoken';
import env from '../../config/env';
import { SendResponse } from '../../utils/SendResponse';
import { authServices } from './auth.service';


// REGISTER WITH GOOGLE
const googleRegister = CatchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const payload = {
      redirect: req.query.redirect || '/',
      mobile: req.query.mobile || false
    };

    const state = Buffer
      .from(JSON.stringify(payload))
      .toString('base64');

    passport.authenticate('google', {
      scope: ['profile', 'email'],
      state,
      prompt: 'consent select_account',
    })(req, res, next);
  }
);

// GOOGLE CALLBACK
const googleCallback = CatchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const state = req.query.state as string;

    const decoded = JSON.parse(
      Buffer.from(state, 'base64').toString()
    );


    if (decoded.redirect.startsWith('/')) {
      decoded.redirect = decoded.redirect.slice(1);
    }

    const user = req.user as JwtPayload;
    if (!user) throw new AppError(httpStatus.BAD_REQUEST, 'User not found');
    const token = await createUserTokens(user);
    SetCookies(res, token);


    // eslint-disable-next-line no-console
    console.log(token.accessToken);


    if (decoded.mobile === 'true') {
      res.redirect(
        `${env.DEEP_LINK}/auth/google?access=${token.accessToken}&refresh=${token.refreshToken}`
      );
    }else {
      res.redirect(
        `${env.FRONTEND_URL}?access=${token.accessToken}`
      );
    }
  }
);

// GOOGLE AUTHENTICATION SYSTEM FOR MOBILE DEVICES
const googleAuthSystem = CatchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await authServices.googleAuthSystem(req.body);

    SendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Authentication success',
      data: result,
    })
  }
);


// CREDENTIALS LOGIN
const credentialsLogin = CatchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('local', async (err: any, user: any, info: any) => {
      if (err) next(err);

      if (!user) {
        return next(new AppError(httpStatus.FORBIDDEN, info.message));
      }

      const userTokens = await createUserTokens(user);
      SetCookies(res, userTokens);

      SendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: 'Login success',
        data: {
          accessToken: userTokens.accessToken },
      });
    })(req, res, next);
  }
);

// CHANGE PASSWORD
const changePassword = CatchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req.user as JwtPayload;
    const { oldPassword, newPassword } = req.body;
    await authServices.changePasswordService(userId, oldPassword, newPassword);

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Password has been changed',
      data: null,
    });
  }
);

const forgetPassword = CatchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email } = req.body;
    const result = await authServices.forgetPasswordService(email);    

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Password reset OTP sent',
      data: result,
    });
  }
);

// VERIFY FORGET PASSWORD OTP
const verifyForgetPasswordOTP = CatchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, otp } = req.body;
    const result = await authServices.verifyForgetPasswordOTPService(
      email as string,
      otp
    );

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'OTP verified',
      data: result,
    });
  }
);

// RESET PASSWORD
const resetPassword = CatchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.token as string;

    const { newPassword } = req.body;
    const result = await authServices.resetPasswordService(token, newPassword);

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Password reset success',
      data: result,
    });
  }
);

// GET NEW ACCESS TOKEN
const getNewAccessToken = CatchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const refreshToken = req.cookies.refreshToken as string;
    if (!refreshToken) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Refresh token is required');
    }
    
    const result = await authServices.getNewAccessTokenService(refreshToken);
    SetCookies(res, {
      refreshToken: result.newRefreshToken,
    });

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'New access token generated',
      data: {
        accessToken: result.newAccessToken,
      },
    });
  }
);

export const authController = {
  googleRegister,
  googleCallback,
  credentialsLogin,
  changePassword,
  forgetPassword,
  verifyForgetPasswordOTP,
  resetPassword,
  getNewAccessToken,
  googleAuthSystem
};
