import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { CatchAsync } from '../../utils/CatchAsync';
import { SendResponse } from '../../utils/SendResponse';
import { SwipeService } from './swipe.service';
import { swipeFeedQueryZodSchema } from './swipe.validate';

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

export const SwipeController = {
  getSwipeFeed,
};
