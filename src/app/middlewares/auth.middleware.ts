import { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../utils/jwt';
import { JwtPayload } from 'jsonwebtoken';
import AppError from '../errorHelpers/AppError';
import httpStatus from 'http-status-codes';
import env from '../config/env';

export const checkAuth =
  (...restRole: string[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accessToken = req.headers.authorization;
      const verifyUser = verifyToken( accessToken as string, env.JWT_SECRET ) as JwtPayload;

      /*
      ----------------------------------------------------------------
      // More checking will be execute here based on application need
      ----------------------------------------------------------------
      */

       
      // CHECK Verified
      if (!verifyUser) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Not Authorized')
      };

      if (!restRole.includes(verifyUser.role)) {
        throw new AppError( httpStatus.FORBIDDEN, 'You are not permitted to access this route')
      };

      req.user = verifyUser; // Set an global type for this line see on: interface > intex.d.ts
      next();
    } catch (error) {
      next(error);
    }
  };
