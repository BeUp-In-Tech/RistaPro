
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { CatchAsync } from '../../utils/CatchAsync';
import { SendResponse } from '../../utils/SendResponse';
import { CallService } from './call.service';
import {
  callCandidateZodSchema,
  inviteCallParticipantZodSchema,
  respondCallParticipantZodSchema,
  startCallZodSchema,
} from './call.validate';

const startCall = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const payload = await startCallZodSchema.parseAsync(req.body);
  const result = await CallService.startCall(String(userId), payload);

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Call started successfully',
    data: result,
  });
});

const acceptCall = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const payload = await callCandidateZodSchema.parseAsync(req.body);
  const result = await CallService.acceptCall(
    String(userId),
    String(req.params.callId),
    payload
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Call accepted successfully',
    data: result,
  });
});

const rejectCall = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const payload = await callCandidateZodSchema.parseAsync(req.body);
  const result = await CallService.rejectCall(
    String(userId),
    String(req.params.callId),
    payload
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Call rejected successfully',
    data: result,
  });
});

const endCall = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const payload = await callCandidateZodSchema.parseAsync(req.body);
  const result = await CallService.endCall(
    String(userId),
    String(req.params.callId),
    payload
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Call ended successfully',
    data: result,
  });
});

const renewCallToken = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const payload = await callCandidateZodSchema.parseAsync(req.body);
  const result = await CallService.renewCallToken(
    String(userId),
    String(req.params.callId),
    payload
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Call token generated successfully',
    data: result,
  });
});

const inviteCallParticipant = CatchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.user as JwtPayload;
    const payload = await inviteCallParticipantZodSchema.parseAsync(req.body);
    const result = await CallService.inviteCallParticipant(
      String(userId),
      String(req.params.callId),
      payload
    );

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Call participant invited successfully',
      data: result,
    });
  }
);

const respondCallParticipant = CatchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.user as JwtPayload;
    const payload = await respondCallParticipantZodSchema.parseAsync(req.body);
    const result = await CallService.respondCallParticipant(
      String(userId),
      String(req.params.callId),
      payload
    );

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Call participant response saved successfully',
      data: result,
    });
  }
);

const getCall = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const result = await CallService.getCall(
    String(userId),
    String(req.params.callId)
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Call retrieved successfully',
    data: result,
  });
});

export const CallController = {
  acceptCall,
  endCall,
  getCall,
  inviteCallParticipant,
  rejectCall,
  renewCallToken,
  respondCallParticipant,
  startCall,
};
