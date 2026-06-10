import { Document, Types } from 'mongoose';
import { IEncryptedMessageBody } from '../message/message.interface';

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
  requesterLinkedUser?: Types.ObjectId;
  targetCandidate: Types.ObjectId;
  targetRespondedBy?: Types.ObjectId;
  conversation?: Types.ObjectId;
  initialMessage?: IEncryptedMessageBody;
  status: ConversationMessageRequestStatus;
  respondedAt?: Date;
  expiresAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
