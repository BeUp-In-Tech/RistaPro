
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import AppError from '../../errorHelpers/AppError';
import { CatchAsync } from '../../utils/CatchAsync';
import { SendResponse } from '../../utils/SendResponse';
import { chatMediaMetadataZodSchema } from '../conversation/conversation.validate';
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

// AUTH OWNER/EDITOR uploads a chat image to Cloudinary.
const uploadChatMedia = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const rawMetadata = req.body?.metadata;

  if (typeof rawMetadata !== 'string') {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Chat media metadata is required');
  }

  let parsedMetadata: unknown;
  try {
    parsedMetadata = JSON.parse(rawMetadata);
  } catch {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Chat media metadata must be valid JSON');
  }

  const metadata = await chatMediaMetadataZodSchema.parseAsync(parsedMetadata);
  const result = await MessageService.uploadChatMedia(
    String(userId),
    String(req.params.conversationId),
    metadata,
    req.file
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Chat media uploaded successfully',
    data: result,
  });
});

export const MessageController = {
  sendMessage,
  uploadChatMedia,
};
