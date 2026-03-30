import { Document, Types } from 'mongoose';

export enum MeetingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  COMPLETED = 'completed',
  RESCHEDULED = 'rescheduled',
}

export interface IMeetingSchedule extends Document {
  consultant: Types.ObjectId;
  candidate: Types.ObjectId;
  schedule_time: Date;
  status: MeetingStatus;
  note?: string;
}
