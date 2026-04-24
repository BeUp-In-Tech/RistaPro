import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { CatchAsync } from '../../utils/CatchAsync';
import { SendResponse } from '../../utils/SendResponse';
import { SwipeService } from './swipe.service';
import { swipeActionZodSchema, swipeFeedQueryZodSchema } from './swipe.validate';

// FEED API: builds the candidate stack for the active candidate profile.
const getSwipeFeed = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const query = await swipeFeedQueryZodSchema.parseAsync(req.query);
  const result = await SwipeService.getSwipeFeed(String(userId), query);

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Swipe feed retrieved successfully',
    data: result,
  });
});

// ACTION API: stores one Tinder-style swipe decision and returns match state.
const performSwipeAction = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const payload = await swipeActionZodSchema.parseAsync(req.body);
  const result = await SwipeService.performSwipeAction(String(userId), payload);

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Swipe action saved successfully',
    data: result,
  });
});

export const SwipeController = {
  getSwipeFeed,
  performSwipeAction,
};
