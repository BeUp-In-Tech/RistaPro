import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { CatchAsync } from '../../utils/CatchAsync';
import { SendResponse } from '../../utils/SendResponse';
import { NotificationService } from './notification.service';
import { notificationListQueryZodSchema } from './notification.validate';

const getMyNotifications = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const query = await notificationListQueryZodSchema.parseAsync(req.query);
  const result = await NotificationService.getMyNotifications(
    String(userId),
    query
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Notifications retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const markNotificationSeen = CatchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.user as JwtPayload;
    const result = await NotificationService.markNotificationSeen(
      String(userId),
      String(req.params.id)
    );

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Notification marked as seen',
      data: result,
    });
  }
);

export const NotificationController = {
  getMyNotifications,
  markNotificationSeen,
};
