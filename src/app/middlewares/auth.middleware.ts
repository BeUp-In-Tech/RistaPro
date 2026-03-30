import { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../utils/jwt';
import { JwtPayload } from 'jsonwebtoken';
import AppError from '../errorHelpers/AppError';
import httpStatus, { StatusCodes } from 'http-status-codes';
import env from '../config/env';

export const checkAuth =
  (...restRole: string[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization as string; // GET TOKEN
      const accessToken = authHeader.split(' ')[1];

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'Token not provided!');
      }

      if (!accessToken) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'Token required');
      }

      const verifyUser = verifyToken(
        accessToken as string,
        env.JWT_ACCESS_SECRET
      ) as JwtPayload;

      /*
      ----------------------------------------------------------------
      // More checking will be execute here based on application need
      ----------------------------------------------------------------
      */

      // CHECK Verified
      if (!verifyUser) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Not Authorized');
      }

      if (!restRole.includes(verifyUser.role)) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          'You are not permitted to access this route'
        );
      }

      req.user = verifyUser; // Set an global type for this line see on: interface > intex.d.ts
      next();
    } catch (error) {
      next(error);
    }
  };
