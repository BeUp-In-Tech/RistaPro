import { Document, Types } from 'mongoose';

export enum ConversationStatus {
  OPEN = 'OPEN',
  ARCHIVED = 'ARCHIVED',
  BLOCKED = 'BLOCKED',
}

export interface IConversation extends Document {
  participants: Types.ObjectId[];
  status: ConversationStatus;
  parentInvolvement?: boolean;
  lastMessage?: Types.ObjectId;
  unreadCounts?: Map<string, number>; // userId -> unread count} // mulitple user count
}
