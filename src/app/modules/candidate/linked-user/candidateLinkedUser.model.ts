import { Schema, model } from 'mongoose';
import {
  CandidateLinkedUserAccessRole,
  CandidateLinkedUserRelation,
  CandidateLinkedUserStatus,
  ICandidateLinkedUser,
} from './candidateLinkedUser.interface';

const candidateLinkedUserSchema = new Schema<ICandidateLinkedUser>(
  {
    candidate: { type: Schema.Types.ObjectId, ref: 'candidate', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    name: {type: String, required: true, trim: true},
    relationshipToCandidate: {
      type: String,
      enum: Object.values(CandidateLinkedUserRelation),
      required: true,
    },
    accessRole: {
      type: String,
      enum: Object.values(CandidateLinkedUserAccessRole),
      required: true,
      default: CandidateLinkedUserAccessRole.EDITOR,
    },
    status: {
      type: String,
      enum: Object.values(CandidateLinkedUserStatus),
      required: true,
      default: CandidateLinkedUserStatus.ACTIVE,
    },
    // The primary linked user is the safest fallback owner for profile control.
    isPrimary: { type: Boolean, default: false },
    linkedBy: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    joinedAt: { type: Date, default: Date.now },
    removedAt: { type: Date },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

candidateLinkedUserSchema.index({ candidate: 1, user: 1 }, { unique: true });
candidateLinkedUserSchema.index({ candidate: 1, status: 1, accessRole: 1 });
candidateLinkedUserSchema.index({ user: 1, status: 1, accessRole: 1 });

candidateLinkedUserSchema.index(
  { candidate: 1, isPrimary: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isPrimary: true,
      status: CandidateLinkedUserStatus.ACTIVE,
    },
  }
);

candidateLinkedUserSchema.index(
  { candidate: 1, relationshipToCandidate: 1 },
  {
    unique: true,
    partialFilterExpression: {
      relationshipToCandidate: CandidateLinkedUserRelation.SELF,
      status: CandidateLinkedUserStatus.ACTIVE,
    },
  }
);

candidateLinkedUserSchema.index(
  { user: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: CandidateLinkedUserStatus.ACTIVE,
    },
  }
);

const CandidateLinkedUser = model<ICandidateLinkedUser>(
  'candidate_linked_user',
  candidateLinkedUserSchema
);

export default CandidateLinkedUser;
