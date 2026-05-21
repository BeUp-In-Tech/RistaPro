import { Schema, model } from 'mongoose';
import {
  IRishtaMarriageRequest,
  IRishtaProgress,
  RishtaMarriageRequestStatus,
  RishtaProgressStatus,
  RishtaProgressStep,
  RishtaProgressStepSource,
} from './rishta_progress.interface';
import { Role } from '../user/user.interface';

const rishtaProgressStepDetailSchema = new Schema(
  {
    step: {
      type: String,
      enum: Object.values(RishtaProgressStep),
      required: true,
    },
    completedAt: { type: Date, required: true, default: Date.now },
    source: {
      type: String,
      enum: Object.values(RishtaProgressStepSource),
      required: true,
    },
    referenceId: { type: Schema.Types.ObjectId },
    completedBy: { type: Schema.Types.ObjectId, ref: 'user' },
  },
  { _id: false, versionKey: false }
);

const rishtaProgressSchema = new Schema<IRishtaProgress>(
  {
    candidates: {
      type: [{ type: Schema.Types.ObjectId, ref: 'candidate', required: true }],
      validate: [
        (arr: unknown[]) => Array.isArray(arr) && arr.length === 2,
        'Exactly two candidates are required',
      ],
    },
    pairKey: { type: String, required: true, trim: true },
    match: { type: Schema.Types.ObjectId, ref: 'match' },
    conversation: { type: Schema.Types.ObjectId, ref: 'conversation' },
    completedSteps: {
      type: [
        {
          type: String,
          enum: Object.values(RishtaProgressStep),
        },
      ],
      default: [],
    },
    progressValue: { type: Number, default: 0, min: 0, max: 100 },
    status: {
      type: String,
      enum: Object.values(RishtaProgressStatus),
      default: RishtaProgressStatus.ACTIVE,
    },
    stepDetails: {
      type: [rishtaProgressStepDetailSchema],
      default: [],
    },
    marriedAt: { type: Date },
    marriageConfirmedBy: { type: Schema.Types.ObjectId, ref: 'user' },
    consultantUser: { type: Schema.Types.ObjectId, ref: 'user' },
  },
  { timestamps: true, versionKey: false }
);

rishtaProgressSchema.index({ pairKey: 1 }, { unique: true });
rishtaProgressSchema.index({ candidates: 1, status: 1, updatedAt: -1 });
rishtaProgressSchema.index({ status: 1, marriedAt: -1 });
rishtaProgressSchema.index({ consultantUser: 1, status: 1, marriedAt: -1 });

const rishtaMarriageApprovalSchema = new Schema(
  {
    candidate: {
      type: Schema.Types.ObjectId,
      ref: 'candidate',
      required: true,
    },
    user: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    linkedUser: { type: Schema.Types.ObjectId, ref: 'candidate_linked_user' },
    respondedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false, versionKey: false }
);

const rishtaMarriageRequestSchema = new Schema<IRishtaMarriageRequest>(
  {
    pairKey: { type: String, required: true, trim: true },
    candidates: {
      type: [{ type: Schema.Types.ObjectId, ref: 'candidate', required: true }],
      validate: [
        (arr: unknown[]) => Array.isArray(arr) && arr.length === 2,
        'Exactly two candidates are required',
      ],
    },
    progress: {
      type: Schema.Types.ObjectId,
      ref: 'rishtaProgress',
      required: true,
    },
    requestedByUser: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    requestedByRole: {
      type: String,
      enum: Object.values(Role),
      required: true,
    },
    requestedByCandidate: { type: Schema.Types.ObjectId, ref: 'candidate' },
    requestedByLinkedUser: {
      type: Schema.Types.ObjectId,
      ref: 'candidate_linked_user',
    },
    consultantUser: { type: Schema.Types.ObjectId, ref: 'user' },
    status: {
      type: String,
      enum: Object.values(RishtaMarriageRequestStatus),
      default: RishtaMarriageRequestStatus.PENDING,
    },
    approvals: {
      type: [rishtaMarriageApprovalSchema],
      default: [],
    },
    rejectedByCandidate: { type: Schema.Types.ObjectId, ref: 'candidate' },
    rejectedByUser: { type: Schema.Types.ObjectId, ref: 'user' },
    rejectedAt: { type: Date },
    rejectReason: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false }
);

rishtaMarriageRequestSchema.index(
  { pairKey: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: RishtaMarriageRequestStatus.PENDING,
    },
  }
);
rishtaMarriageRequestSchema.index({ candidates: 1, status: 1, createdAt: -1 });
rishtaMarriageRequestSchema.index({ requestedByUser: 1, createdAt: -1 });
rishtaMarriageRequestSchema.index({ consultantUser: 1, status: 1, createdAt: -1 });

const RishtaProgress = model<IRishtaProgress>(
  'rishtaProgress',
  rishtaProgressSchema
);

export const RishtaMarriageRequest = model<IRishtaMarriageRequest>(
  'rishtaMarriageRequest',
  rishtaMarriageRequestSchema
);

export default RishtaProgress;
