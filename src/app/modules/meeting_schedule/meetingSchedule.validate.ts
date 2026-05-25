import { Types } from 'mongoose';
import z from 'zod';
import { MeetingStatus, MeetingType } from './meetingSchedule.interface';

const objectIdSchema = (fieldLabel: string) =>
  z
    .string({ error: `${fieldLabel} is required` })
    .trim()
    .min(1, `${fieldLabel} is required`)
    .refine((value) => Types.ObjectId.isValid(value), {
      message: `Invalid ${fieldLabel.toLowerCase()}`,
    });

const futureDateSchema = (fieldLabel: string) =>
  z.coerce
    .date({ error: `${fieldLabel} must be a valid date` })
    .refine((value) => value.getTime() > Date.now(), {
      message: `${fieldLabel} must be in the future`,
    });

const requestedTimeSlotsSchema = z
  .array(futureDateSchema('Requested time slot'))
  .max(5, 'You can request at most 5 time slots')
  .optional();

export const createMeetingScheduleZodSchema = z
  .object({
    candidateId: objectIdSchema('Candidate id'),
    consultantId: objectIdSchema('Consultant id'),
    requestedTimeSlots: requestedTimeSlotsSchema,
    type: z.nativeEnum(MeetingType, { error: 'Invalid meeting type' }),
    note: z
      .string({ error: 'Note must be string type!' })
      .trim()
      .max(500, 'Note must be at most 500 characters long')
      .optional(),
  })
  .strict();

export const confirmMeetingScheduleZodSchema = z
  .object({
    schedule_time: futureDateSchema('Schedule time'),
    consultantNote: z
      .string({ error: 'Consultant note must be string type!' })
      .trim()
      .max(500, 'Consultant note must be at most 500 characters long')
      .optional(),
  })
  .strict();

export const rescheduleMeetingZodSchema = z
  .object({
    requestedTimeSlots: requestedTimeSlotsSchema,
    schedule_time: futureDateSchema('Schedule time').optional(),
    note: z
      .string({ error: 'Note must be string type!' })
      .trim()
      .max(500, 'Note must be at most 500 characters long')
      .optional(),
    consultantNote: z
      .string({ error: 'Consultant note must be string type!' })
      .trim()
      .max(500, 'Consultant note must be at most 500 characters long')
      .optional(),
  })
  .strict()
  .refine(
    (payload) =>
      payload.schedule_time !== undefined ||
      payload.requestedTimeSlots !== undefined ||
      payload.note !== undefined ||
      payload.consultantNote !== undefined,
    {
      message: 'At least one reschedule field is required',
      path: ['schedule_time'],
    }
  );

export const meetingScheduleListQueryZodSchema = z
  .object({
    candidateId: objectIdSchema('Candidate id').optional(),
    status: z.nativeEnum(MeetingStatus, { error: 'Invalid meeting status' }).optional(),
  })
  .strict();

export const joinMeetingScheduleZodSchema = z
  .object({
    candidateId: objectIdSchema('Candidate id').optional(),
  })
  .strict();
