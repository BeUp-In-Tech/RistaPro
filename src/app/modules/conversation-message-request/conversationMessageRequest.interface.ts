import { Document, Types } from 'mongoose';

export enum ConversationMessageRequestStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export interface IConversationMessageRequest extends Document {
  pairKey: string;
  requesterCandidate: Types.ObjectId;
  requesterUser: Types.ObjectId;
  targetCandidate: Types.ObjectId;
  targetRespondedBy?: Types.ObjectId;
  firstMessage: string;
  conversation?: Types.ObjectId;
  status: ConversationMessageRequestStatus;
  respondedAt?: Date;
  expiresAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
