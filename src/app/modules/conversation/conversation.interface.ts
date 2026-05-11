import { Document, Types } from 'mongoose';

export enum ConversationSource {
  MATCH = 'MATCH',
  MESSAGE_REQUEST = 'MESSAGE_REQUEST',
}

export enum ConversationStatus {
  OPEN = 'OPEN',
  ARCHIVED = 'ARCHIVED',
  BLOCKED = 'BLOCKED',
}

export interface IConversation extends Document {
  match?: Types.ObjectId;
  messageRequest?: Types.ObjectId;
  pairKey: string;
  participants: Types.ObjectId[];
  source: ConversationSource;
  status: ConversationStatus;
  parentInvolvement?: boolean;
  lastMessage?: Types.ObjectId;
  unreadCounts?: Map<string, number>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TConversationIdLean {
  _id: Types.ObjectId;
}
