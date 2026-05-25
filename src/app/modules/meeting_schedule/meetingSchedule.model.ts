import { Schema, model } from 'mongoose';
import {
  IMeetingSchedule,
  MeetingParticipantRole,
  MeetingStatus,
  MeetingType,
} from './meetingSchedule.interface';

const meetingParticipantSchema = new Schema(
  {
    agoraUid: { type: Number, required: true },
    candidate: { type: Schema.Types.ObjectId, ref: 'candidate' },
    guestDisplayName: { type: String, trim: true },
    guestInvite: { type: Schema.Types.ObjectId, ref: 'consultantGuestInvite' },
    joinedAt: { type: Date, required: true, default: Date.now },
    linkedUser: { type: Schema.Types.ObjectId, ref: 'candidate_linked_user' },
    role: {
      type: String,
      enum: Object.values(MeetingParticipantRole),
      required: true,
    },
    user: { type: Schema.Types.ObjectId, ref: 'user' },
  },
  { _id: false, versionKey: false }
);

const meetingScheduleSchema = new Schema<IMeetingSchedule>(
  {
    consultant: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    candidate: { type: Schema.Types.ObjectId, ref: 'candidate', required: true },
    case: { type: Schema.Types.ObjectId, ref: 'consultationCase' },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    confirmedBy: { type: Schema.Types.ObjectId, ref: 'user' },
    requestedTimeSlots: { type: [Date], default: [] },
    schedule_time: { type: Date },
    status: {
      type: String,
      enum: Object.values(MeetingStatus),
      default: MeetingStatus.PENDING,
    },
    type: {
      type: String,
      enum: Object.values(MeetingType),
      required: true,
      default: MeetingType.VIDEO,
    },
    rescheduleCount: { type: Number, default: 0, min: 0 },
    reminderOneHourSentAt: { type: Date },
    joinWindowStartsAt: { type: Date },
    joinWindowEndsAt: { type: Date },
    note: { type: String },
    consultantNote: { type: String },
    cancelReason: { type: String },
    agoraChannelName: { type: String, trim: true },
    participants: { type: [meetingParticipantSchema], default: [] },
  },
  { timestamps: true, versionKey: false }
);

meetingScheduleSchema.index({ consultant: 1, status: 1, schedule_time: 1 });
meetingScheduleSchema.index({ candidate: 1, status: 1, schedule_time: 1 });
meetingScheduleSchema.index({ case: 1, status: 1, schedule_time: 1 });
meetingScheduleSchema.index({ schedule_time: 1, status: 1 });
meetingScheduleSchema.index({ agoraChannelName: 1 }, { sparse: true });

const MeetingSchedule = model<IMeetingSchedule>('meetingSchedule', meetingScheduleSchema);

export default MeetingSchedule;
