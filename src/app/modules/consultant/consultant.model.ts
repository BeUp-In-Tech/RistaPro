import { Schema, model } from 'mongoose';
import {
  ConsultantAssignmentStatus,
  ConsultantCandidateInviteStatus,
  ConsultantGuestInviteStatus,
  ConsultantMarriagePartyType,
  ConsultationCaseStatus,
  ConsultationMessageSenderType,
  IConsultantAssignment,
  IConsultantCandidateInvite,
  IConsultantMarriageRecord,
  IConsultationCase,
  IConsultationMessage,
  IConsultantGuestInvite,
} from './consultant.interface';

const consultantAssignmentSchema = new Schema<IConsultantAssignment>(
  {
    assignedBy: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    candidate: { type: Schema.Types.ObjectId, ref: 'candidate', required: true },
    consultant: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    note: { type: String, trim: true },
    status: {
      type: String,
      enum: Object.values(ConsultantAssignmentStatus),
      default: ConsultantAssignmentStatus.ACTIVE,
      required: true,
    },
  },
  { timestamps: true, versionKey: false }
);

consultantAssignmentSchema.index(
  { consultant: 1, candidate: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: ConsultantAssignmentStatus.ACTIVE,
    },
  }
);
consultantAssignmentSchema.index({ candidate: 1, status: 1, createdAt: -1 });
consultantAssignmentSchema.index({ consultant: 1, status: 1, createdAt: -1 });

const consultationGuestParticipantSchema = new Schema(
  {
    contact: { type: String, trim: true },
    displayName: { type: String, required: true, trim: true },
    guestInvite: {
      type: Schema.Types.ObjectId,
      ref: 'consultantGuestInvite',
      required: true,
    },
    joinedAt: { type: Date },
  },
  { _id: false, versionKey: false }
);

const consultationCaseSchema = new Schema<IConsultationCase>(
  {
    candidates: {
      type: [{ type: Schema.Types.ObjectId, ref: 'candidate' }],
      default: [],
      validate: [
        (items: unknown[]) => Array.isArray(items) && items.length <= 2,
        'A consultation case can have at most two real candidates',
      ],
    },
    consultant: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    guestParticipants: {
      type: [consultationGuestParticipantSchema],
      default: [],
    },
    lastMessage: { type: Schema.Types.ObjectId, ref: 'consultationMessage' },
    note: { type: String, trim: true },
    primaryCandidate: { type: Schema.Types.ObjectId, ref: 'candidate' },
    status: {
      type: String,
      enum: Object.values(ConsultationCaseStatus),
      default: ConsultationCaseStatus.OPEN,
      required: true,
    },
    title: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false }
);

consultationCaseSchema.index({ consultant: 1, status: 1, updatedAt: -1 });
consultationCaseSchema.index({ candidates: 1, status: 1, updatedAt: -1 });
consultationCaseSchema.index({
  consultant: 1,
  primaryCandidate: 1,
  status: 1,
  updatedAt: -1,
});

const consultantCandidateInviteSchema =
  new Schema<IConsultantCandidateInvite>(
    {
      candidate: { type: Schema.Types.ObjectId, ref: 'candidate', required: true },
      case: { type: Schema.Types.ObjectId, ref: 'consultationCase', required: true },
      consultant: { type: Schema.Types.ObjectId, ref: 'user', required: true },
      invitedBy: { type: Schema.Types.ObjectId, ref: 'user', required: true },
      respondedAt: { type: Date },
      respondedBy: { type: Schema.Types.ObjectId, ref: 'user' },
      status: {
        type: String,
        enum: Object.values(ConsultantCandidateInviteStatus),
        default: ConsultantCandidateInviteStatus.PENDING,
        required: true,
      },
    },
    { timestamps: true, versionKey: false }
  );

consultantCandidateInviteSchema.index({ candidate: 1, status: 1, createdAt: -1 });
consultantCandidateInviteSchema.index({ case: 1, status: 1, createdAt: -1 });
consultantCandidateInviteSchema.index(
  { case: 1, candidate: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: ConsultantCandidateInviteStatus.PENDING,
    },
  }
);

const consultationMessageSchema = new Schema<IConsultationMessage>(
  {
    case: { type: Schema.Types.ObjectId, ref: 'consultationCase', required: true },
    guestDisplayName: { type: String, trim: true },
    guestInvite: { type: Schema.Types.ObjectId, ref: 'consultantGuestInvite' },
    message: { type: String, required: true, trim: true },
    seenByUsers: [{ type: Schema.Types.ObjectId, ref: 'user' }],
    senderCandidate: { type: Schema.Types.ObjectId, ref: 'candidate' },
    senderLinkedUser: {
      type: Schema.Types.ObjectId,
      ref: 'candidate_linked_user',
    },
    senderType: {
      type: String,
      enum: Object.values(ConsultationMessageSenderType),
      required: true,
    },
    senderUser: { type: Schema.Types.ObjectId, ref: 'user' },
  },
  { timestamps: true, versionKey: false }
);

consultationMessageSchema.index({ case: 1, createdAt: -1 });

const consultantGuestInviteSchema = new Schema<IConsultantGuestInvite>(
  {
    case: { type: Schema.Types.ObjectId, ref: 'consultationCase', required: true },
    consultant: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    contact: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    displayName: { type: String, required: true, trim: true },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date },
    status: {
      type: String,
      enum: Object.values(ConsultantGuestInviteStatus),
      default: ConsultantGuestInviteStatus.ACTIVE,
      required: true,
    },
    tokenHash: { type: String, required: true, unique: true },
  },
  { timestamps: true, versionKey: false }
);

consultantGuestInviteSchema.index({ case: 1, status: 1, expiresAt: 1 });
consultantGuestInviteSchema.index({ tokenHash: 1 }, { unique: true });

const consultantMarriagePartySchema = new Schema(
  {
    candidate: { type: Schema.Types.ObjectId, ref: 'candidate' },
    contact: { type: String, trim: true },
    displayName: { type: String, trim: true },
    guestInvite: { type: Schema.Types.ObjectId, ref: 'consultantGuestInvite' },
    partyType: {
      type: String,
      enum: Object.values(ConsultantMarriagePartyType),
      required: true,
    },
  },
  { _id: false, versionKey: false }
);

const consultantMarriageRecordSchema =
  new Schema<IConsultantMarriageRecord>(
    {
      case: { type: Schema.Types.ObjectId, ref: 'consultationCase' },
      consultant: { type: Schema.Types.ObjectId, ref: 'user', required: true },
      createdBy: { type: Schema.Types.ObjectId, ref: 'user', required: true },
      marriedAt: { type: Date, required: true },
      note: { type: String, trim: true },
      parties: {
        type: [consultantMarriagePartySchema],
        required: true,
        validate: [
          (items: unknown[]) => Array.isArray(items) && items.length === 2,
          'Exactly two marriage parties are required',
        ],
      },
      rishtaProgress: { type: Schema.Types.ObjectId, ref: 'rishtaProgress' },
    },
    { timestamps: true, versionKey: false }
  );

consultantMarriageRecordSchema.index({
  consultant: 1,
  marriedAt: -1,
  createdAt: -1,
});
consultantMarriageRecordSchema.index({ case: 1, createdAt: -1 });

export const ConsultantAssignment = model<IConsultantAssignment>(
  'consultantAssignment',
  consultantAssignmentSchema
);

export const ConsultationCase = model<IConsultationCase>(
  'consultationCase',
  consultationCaseSchema
);

export const ConsultantCandidateInvite = model<IConsultantCandidateInvite>(
  'consultantCandidateInvite',
  consultantCandidateInviteSchema
);

export const ConsultationMessage = model<IConsultationMessage>(
  'consultationMessage',
  consultationMessageSchema
);

export const ConsultantGuestInvite = model<IConsultantGuestInvite>(
  'consultantGuestInvite',
  consultantGuestInviteSchema
);

export const ConsultantMarriageRecord = model<IConsultantMarriageRecord>(
  'consultantMarriageRecord',
  consultantMarriageRecordSchema
);
