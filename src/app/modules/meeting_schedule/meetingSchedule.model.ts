import { Schema, model } from 'mongoose';
import { IMeetingSchedule, MeetingStatus } from './meetingSchedule.interface';

const meetingScheduleSchema = new Schema<IMeetingSchedule>(
  {
    consultant: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    candidate: { type: Schema.Types.ObjectId, ref: 'candidate', required: true },
    schedule_time: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(MeetingStatus),
      default: MeetingStatus.PENDING,
    },
    note: { type: String },
  },
  { timestamps: true, versionKey: false }
);

const MeetingSchedule = model<IMeetingSchedule>('meetingSchedule', meetingScheduleSchema);

export default MeetingSchedule;
