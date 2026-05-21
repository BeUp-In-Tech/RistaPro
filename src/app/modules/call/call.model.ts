import { Schema, model } from 'mongoose';
import {
  CallParticipantRole,
  CallParticipantStatus,
  CallStatus,
  CallType,
  ICall,
} from './call.interface';

const callParticipantSchema = new Schema(
  {
    agoraUid: { type: Number, required: true },
    candidate: { type: Schema.Types.ObjectId, ref: 'candidate', required: true },
    invitedAt: { type: Date },
    invitedByLinkedUser: {
      type: Schema.Types.ObjectId,
      ref: 'candidate_linked_user',
    },
    invitedByUser: { type: Schema.Types.ObjectId, ref: 'user' },
    joinedAt: { type: Date },
    leftAt: { type: Date },
    linkedUser: {
      type: Schema.Types.ObjectId,
      ref: 'candidate_linked_user',
      required: true,
    },
    rejectedAt: { type: Date },
    role: {
      type: String,
      enum: Object.values(CallParticipantRole),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(CallParticipantStatus),
      required: true,
    },
    user: { type: Schema.Types.ObjectId, ref: 'user', required: true },
  },
  { _id: false, versionKey: false }
);

const callSchema = new Schema<ICall>(
  {
    callerCandidate: {
      type: Schema.Types.ObjectId,
      ref: 'candidate',
      required: true,
    },
    channelName: { type: String, required: true, trim: true },
    conversation: {
      type: Schema.Types.ObjectId,
      ref: 'conversation',
      required: true,
    },
    createdByLinkedUser: {
      type: Schema.Types.ObjectId,
      ref: 'candidate_linked_user',
      required: true,
    },
    createdByUser: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    endedAt: { type: Date },
    endedByUser: { type: Schema.Types.ObjectId, ref: 'user' },
    endReason: { type: String, trim: true },
    match: { type: Schema.Types.ObjectId, ref: 'match' },
    participants: { type: [callParticipantSchema], default: [] },
    receiverCandidate: {
      type: Schema.Types.ObjectId,
      ref: 'candidate',
      required: true,
    },
    ringExpiresAt: { type: Date, required: true },
    startedAt: { type: Date },
    status: {
      type: String,
      enum: Object.values(CallStatus),
      default: CallStatus.INITIATED,
    },
    type: { type: String, enum: Object.values(CallType), required: true },
  },
  { timestamps: true, versionKey: false }
);

callSchema.index({ conversation: 1, status: 1, createdAt: -1 });
callSchema.index({ channelName: 1 }, { unique: true });
callSchema.index({ 'participants.user': 1, status: 1, updatedAt: -1 });
callSchema.index({ 'participants.linkedUser': 1, status: 1, updatedAt: -1 });

const Call = model<ICall>('call', callSchema);

export default Call;
