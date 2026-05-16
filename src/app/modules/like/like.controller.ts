import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { CatchAsync } from '../../utils/CatchAsync';
import { SendResponse } from '../../utils/SendResponse';
import { LikeService } from './like.service';
import { likeListQueryZodSchema } from './like.validate';

const getReceivedLikes = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const query = await likeListQueryZodSchema.parseAsync(req.query);
  const result = await LikeService.getReceivedLikes(String(userId), query);

  SendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Received likes retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getSentLikes = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const query = await likeListQueryZodSchema.parseAsync(req.query);
  const result = await LikeService.getSentLikes(String(userId), query);

  SendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Sent likes retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

export const LikeController = {
  getReceivedLikes,
  getSentLikes,
};
