import { Document, Types } from 'mongoose';

export enum ConversationGuardianRequestStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export interface IConversationGuardianRequest extends Document {
  conversation: Types.ObjectId;
  match?: Types.ObjectId;
  pairKey: string;
  requesterCandidate: Types.ObjectId;
  requesterUser: Types.ObjectId;
  requestedGuardianLinkedUser: Types.ObjectId;
  requestedGuardianUser: Types.ObjectId;
  targetCandidate: Types.ObjectId;
  targetRespondedBy?: Types.ObjectId;
  status: ConversationGuardianRequestStatus;
  message?: string;
  respondedAt?: Date;
  expiresAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
