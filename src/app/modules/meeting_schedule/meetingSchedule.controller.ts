
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { CatchAsync } from '../../utils/CatchAsync';
import { SendResponse } from '../../utils/SendResponse';
import { Role } from '../user/user.interface';
import { MeetingScheduleService } from './meetingSchedule.service';
import {
  confirmMeetingScheduleZodSchema,
  createMeetingScheduleZodSchema,
  joinMeetingScheduleZodSchema,
  meetingScheduleListQueryZodSchema,
  rescheduleMeetingZodSchema,
} from './meetingSchedule.validate';

const createMeetingSchedule = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const payload = await createMeetingScheduleZodSchema.parseAsync(req.body);
  const result = await MeetingScheduleService.createMeetingSchedule(
    String(userId),
    payload
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Meeting request created successfully',
    data: result,
  });
});

const confirmMeetingSchedule = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const payload = await confirmMeetingScheduleZodSchema.parseAsync(req.body);
  const result = await MeetingScheduleService.confirmMeetingSchedule(
    String(userId),
    String(req.params.meetingId),
    payload
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Meeting confirmed successfully',
    data: result,
  });
});

const rescheduleMeeting = CatchAsync(async (req: Request, res: Response) => {
  const { role, userId } = req.user as JwtPayload;
  const payload = await rescheduleMeetingZodSchema.parseAsync(req.body);
  const result = await MeetingScheduleService.rescheduleMeeting(
    String(userId),
    role as Role,
    String(req.params.meetingId),
    payload
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Meeting rescheduled successfully',
    data: result,
  });
});

const getMeetingSchedule = CatchAsync(async (req: Request, res: Response) => {
  const { role, userId } = req.user as JwtPayload;
  const result = await MeetingScheduleService.getMeetingSchedule(
    String(userId),
    role as Role,
    String(req.params.meetingId)
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Meeting retrieved successfully',
    data: result,
  });
});

const getMeetingSchedules = CatchAsync(async (req: Request, res: Response) => {
  const { role, userId } = req.user as JwtPayload;
  const query = await meetingScheduleListQueryZodSchema.parseAsync(req.query);
  const result = await MeetingScheduleService.getMeetingSchedules(
    String(userId),
    role as Role,
    query
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Meetings retrieved successfully',
    data: result,
  });
});

const joinMeetingSchedule = CatchAsync(async (req: Request, res: Response) => {
  const { role, userId } = req.user as JwtPayload;
  const payload = await joinMeetingScheduleZodSchema.parseAsync(req.body);
  const result = await MeetingScheduleService.joinMeetingSchedule(
    String(userId),
    role as Role,
    String(req.params.meetingId),
    payload
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Meeting joined successfully',
    data: result,
  });
});

const joinGuestMeetingSchedule = CatchAsync(async (req: Request, res: Response) => {
  const result = await MeetingScheduleService.joinGuestMeetingSchedule(
    String(req.params.token),
    String(req.params.meetingId)
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Guest meeting joined successfully',
    data: result,
  });
});

export const MeetingScheduleController = {
  confirmMeetingSchedule,
  createMeetingSchedule,
  getMeetingSchedule,
  getMeetingSchedules,
  joinGuestMeetingSchedule,
  joinMeetingSchedule,
  rescheduleMeeting,
};
