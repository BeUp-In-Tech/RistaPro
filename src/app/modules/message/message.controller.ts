
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { CatchAsync } from '../../utils/CatchAsync';
import { SendResponse } from '../../utils/SendResponse';
import { ISendMessagePayload } from './message.interface';
import { MessageService } from './message.service';

// AUTH OWNER/EDITOR sends one chat message.
const sendMessage = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const result = await MessageService.sendMessage(
    String(userId),
    req.body as ISendMessagePayload
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Message sent successfully',
    data: result,
  });
});

export const MessageController = {
  sendMessage,
};
