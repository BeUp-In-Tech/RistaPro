import { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../utils/jwt';
import { JwtPayload } from 'jsonwebtoken';
import AppError from '../errorHelpers/AppError';
import httpStatus, { StatusCodes } from 'http-status-codes';
import env from '../config/env';
import { ActiveStatus } from '../modules/user/user.interface';
import User from '../modules/user/user.model';

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


      // CHECK VERIFIED
      if (!verifyUser) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'You are unauthorized');
      };

      const isUser = await User.findById(verifyUser.userId);
      if (!isUser) {
        throw new AppError(StatusCodes.NOT_FOUND, "User not found");
      }


       if (
        isUser.isActive === ActiveStatus.INACTIVE ||
        isUser.isActive === ActiveStatus.BLOCKED
      ) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          'User is Blocked or Inactive!'
        );
      }

      if (isUser.isDeleted) {
        throw new AppError(httpStatus.FORBIDDEN, 'The user was deleted!');
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
