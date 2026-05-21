import { Document, Types } from 'mongoose';
import { ConversationStatus, IConversationGuardianParticipant } from '../conversation/conversation.interface';

export enum CallType {
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
}

export enum CallStatus {
  INITIATED = 'INITIATED',
  ACTIVE = 'ACTIVE',
  MISSED = 'MISSED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
}

export enum CallParticipantRole {
  CALLER = 'CALLER',
  RECEIVER = 'RECEIVER',
  INVITED_LINKED_USER = 'INVITED_LINKED_USER',
}

export enum CallParticipantStatus {
  INVITED = 'INVITED',
  JOINED = 'JOINED',
  REJECTED = 'REJECTED',
  LEFT = 'LEFT',
}

export interface ICallParticipant {
  agoraUid: number;
  candidate: Types.ObjectId;
  invitedAt?: Date;
  invitedByLinkedUser?: Types.ObjectId;
  invitedByUser?: Types.ObjectId;
  joinedAt?: Date;
  leftAt?: Date;
  linkedUser: Types.ObjectId;
  rejectedAt?: Date;
  role: CallParticipantRole;
  status: CallParticipantStatus;
  user: Types.ObjectId;
}

export interface ICall extends Document {
  channelName: string;
  conversation: Types.ObjectId;
  createdByLinkedUser: Types.ObjectId;
  createdByUser: Types.ObjectId;
  callerCandidate: Types.ObjectId;
  endedAt?: Date;
  endedByUser?: Types.ObjectId;
  endReason?: string;
  match?: Types.ObjectId;
  participants: ICallParticipant[];
  receiverCandidate: Types.ObjectId;
  ringExpiresAt: Date;
  startedAt?: Date;
  type: CallType;
  status: CallStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IStartCallPayload {
  candidateId: string;
  conversationId: string;
  type: CallType;
}

export interface ICallCandidatePayload {
  candidateId: string;
}

export interface IInviteCallParticipantPayload {
  candidateId: string;
  linkedUserId: string;
}

export interface IRespondCallParticipantPayload {
  action: 'ACCEPT' | 'REJECT';
  candidateId: string;
  linkedUserId: string;
}


export interface TCallLean {
  _id: Types.ObjectId;
  callerCandidate: Types.ObjectId;
  channelName: string;
  conversation: Types.ObjectId;
  createdAt?: Date;
  createdByLinkedUser: Types.ObjectId;
  createdByUser: Types.ObjectId;
  endedAt?: Date;
  endedByUser?: Types.ObjectId;
  endReason?: string;
  match?: Types.ObjectId;
  participants: ICallParticipant[];
  receiverCandidate: Types.ObjectId;
  ringExpiresAt: Date;
  startedAt?: Date;
  status: CallStatus;
  type: CallType;
  updatedAt?: Date;
};

export interface TConversationForCall {
  _id: Types.ObjectId;
  guardianParticipants?: IConversationGuardianParticipant[];
  match?: Types.ObjectId;
  participants: Types.ObjectId[];
  status: ConversationStatus;
};

export interface TCallParticipantForResponse {
  agoraUid: number;
  candidate: Types.ObjectId;
  invitedAt?: Date;
  invitedByLinkedUser?: Types.ObjectId;
  invitedByUser?: Types.ObjectId;
  joinedAt?: Date;
  leftAt?: Date;
  linkedUser: Types.ObjectId;
  rejectedAt?: Date;
  role: CallParticipantRole;
  status: CallParticipantStatus;
  user: Types.ObjectId;
};