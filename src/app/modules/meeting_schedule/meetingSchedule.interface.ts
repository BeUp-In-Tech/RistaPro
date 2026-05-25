import { Document, Types } from 'mongoose';

export enum MeetingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  RESCHEDULE_REQUESTED = 'RESCHEDULE_REQUESTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
}

export enum MeetingParticipantRole {
  CONSULTANT = 'CONSULTANT',
  CANDIDATE = 'CANDIDATE',
  GUEST = 'GUEST',
}

export enum MeetingType {
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
}

export interface IMeetingParticipant {
  agoraUid: number;
  candidate?: Types.ObjectId;
  guestDisplayName?: string;
  guestInvite?: Types.ObjectId;
  joinedAt: Date;
  linkedUser?: Types.ObjectId;
  role: MeetingParticipantRole;
  user?: Types.ObjectId;
}

export interface IMeetingSchedule extends Document {
  consultant: Types.ObjectId;
  candidate: Types.ObjectId;
  case?: Types.ObjectId;
  requestedBy: Types.ObjectId;
  confirmedBy?: Types.ObjectId;
  requestedTimeSlots?: Date[];
  schedule_time?: Date;
  status: MeetingStatus;
  type: MeetingType;
  rescheduleCount: number;
  reminderOneHourSentAt?: Date;
  joinWindowStartsAt?: Date;
  joinWindowEndsAt?: Date;
  note?: string;
  consultantNote?: string;
  cancelReason?: string;
  agoraChannelName?: string;
  participants: IMeetingParticipant[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICreateMeetingSchedulePayload {
  candidateId: string;
  consultantId: string;
  requestedTimeSlots?: Date[];
  type: MeetingType;
  note?: string;
}

export interface IConfirmMeetingSchedulePayload {
  schedule_time: Date;
  consultantNote?: string;
}

export interface IRescheduleMeetingPayload {
  requestedTimeSlots?: Date[];
  schedule_time?: Date;
  note?: string;
  consultantNote?: string;
}

export interface IMeetingScheduleListQuery {
  candidateId?: string;
  status?: MeetingStatus;
}

export interface IJoinMeetingSchedulePayload {
  candidateId?: string;
}
