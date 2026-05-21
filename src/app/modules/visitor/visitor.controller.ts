
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { CatchAsync } from '../../utils/CatchAsync';
import { SendResponse } from '../../utils/SendResponse';
import { VisitorService } from './visitor.service';
import {
  profileVisitorListQueryZodSchema,
  trackProfileVisitZodSchema,
} from './visitor.validate';

const trackProfileVisit = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const payload = await trackProfileVisitZodSchema.parseAsync(req.body);
  const result = await VisitorService.trackProfileVisit(String(userId), payload);

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: result.tracked
      ? 'Profile visit tracked successfully'
      : 'Profile visit ignored',
    data: result,
  });
});

const getProfileVisitors = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const query = await profileVisitorListQueryZodSchema.parseAsync(req.query);
  const result = await VisitorService.getProfileVisitors(String(userId), query);

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Profile visitors retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

export const VisitorController = {
  getProfileVisitors,
  trackProfileVisit,
};
