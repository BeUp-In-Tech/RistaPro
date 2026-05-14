import { Document, Types } from 'mongoose';

export enum MessageType {
  TEXT = 'TEXT',
  SYSTEM = 'SYSTEM',
  CALL = 'CALL',
}

export interface IMessage extends Document {
  conversation: Types.ObjectId;
  sender: Types.ObjectId;
  sentBy: Types.ObjectId;
  sentByLinkedUser?: Types.ObjectId;
  message: string;
  type: MessageType;
  seenBy: Types.ObjectId[];
  replyTo?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

export interface ISendMessagePayload {
  conversationId: string;
  candidateId: string;
  message: string;
  replyTo?: string;
}
