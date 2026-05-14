import { Document, Types } from 'mongoose';
import { ConversationMessageRequestStatus } from '../conversation-message-request/conversationMessageRequest.interface';
import { ConversationGuardianRequestStatus } from './conversationGuardianRequest.interface';

export enum ConversationSource {
  MATCH = 'MATCH',
  MESSAGE_REQUEST = 'MESSAGE_REQUEST',
}

export enum ConversationStatus {
  OPEN = 'OPEN',
  ARCHIVED = 'ARCHIVED',
  BLOCKED = 'BLOCKED',
}

export interface IConversationGuardianParticipant {
  candidate: Types.ObjectId;
  linkedUser: Types.ObjectId;
  user: Types.ObjectId;
  addedBy: Types.ObjectId;
  addedAt: Date;
  removedBy?: Types.ObjectId;
  removedAt?: Date;
  isActive: boolean;
}

export interface IConversation extends Document {
  match?: Types.ObjectId;
  messageRequest?: Types.ObjectId;
  pairKey: string;
  participants: Types.ObjectId[];
  source: ConversationSource;
  status: ConversationStatus;
  parentInvolvement?: boolean;
  guardianParticipants?: IConversationGuardianParticipant[];
  lastMessage?: Types.ObjectId;
  unreadCounts?: Map<string, number>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TConversationIdLean {
  _id: Types.ObjectId;
}

export interface IConversationListQuery {
  candidateId: string;
  status?: ConversationStatus;
}

export interface IConversationMessagesQuery {
  candidateId: string;
  before?: string;
  limit: number;
}

export interface ICreateMessageRequestPayload {
  requesterCandidateId: string;
  targetCandidateId: string;
  firstMessage: string;
}

export interface IMessageRequestListQuery {
  candidateId: string;
  status?: ConversationMessageRequestStatus;
  type: 'incoming' | 'outgoing' | 'all';
}

export interface IRespondRequestPayload {
  candidateId: string;
}

export interface ICreateGuardianRequestPayload {
  candidateId: string;
  linkedUserId: string;
  message?: string;
}

export interface IGuardianRequestListQuery {
  candidateId: string;
  status?: ConversationGuardianRequestStatus;
  type: 'incoming' | 'outgoing' | 'all';
}

export type TConversationLean = Partial<IConversation> & {
  _id: Types.ObjectId;
  pairKey: string;
  participants: Types.ObjectId[];
};
