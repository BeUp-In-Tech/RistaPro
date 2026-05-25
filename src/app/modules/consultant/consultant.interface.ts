import { Document, Types } from 'mongoose';

export enum ConsultantAssignmentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum ConsultationCaseStatus {
  OPEN = 'OPEN',
  ARCHIVED = 'ARCHIVED',
  MARRIED = 'MARRIED',
}

export enum ConsultationMessageSenderType {
  CONSULTANT = 'CONSULTANT',
  CANDIDATE_USER = 'CANDIDATE_USER',
  GUEST = 'GUEST',
}

export enum ConsultantGuestInviteStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
}

export enum ConsultantCandidateInviteStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
}

export enum ConsultantMarriagePartyType {
  CANDIDATE = 'CANDIDATE',
  GUEST = 'GUEST',
}

export interface IConsultantAssignment extends Document {
  consultant: Types.ObjectId;
  candidate: Types.ObjectId;
  assignedBy: Types.ObjectId;
  status: ConsultantAssignmentStatus;
  note?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IConsultationGuestParticipant {
  guestInvite: Types.ObjectId;
  displayName: string;
  contact?: string;
  joinedAt?: Date;
}

export interface IConsultationCase extends Document {
  consultant: Types.ObjectId;
  candidates: Types.ObjectId[];
  primaryCandidate?: Types.ObjectId;
  guestParticipants: IConsultationGuestParticipant[];
  status: ConsultationCaseStatus;
  title?: string;
  note?: string;
  createdBy: Types.ObjectId;
  lastMessage?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IConsultantCandidateInvite extends Document {
  case: Types.ObjectId;
  consultant: Types.ObjectId;
  candidate: Types.ObjectId;
  invitedBy: Types.ObjectId;
  status: ConsultantCandidateInviteStatus;
  respondedBy?: Types.ObjectId;
  respondedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IConsultationMessage extends Document {
  case: Types.ObjectId;
  senderType: ConsultationMessageSenderType;
  senderUser?: Types.ObjectId;
  senderCandidate?: Types.ObjectId;
  senderLinkedUser?: Types.ObjectId;
  guestInvite?: Types.ObjectId;
  guestDisplayName?: string;
  message: string;
  seenByUsers: Types.ObjectId[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IConsultantGuestInvite extends Document {
  case: Types.ObjectId;
  consultant: Types.ObjectId;
  tokenHash: string;
  displayName: string;
  contact?: string;
  expiresAt: Date;
  status: ConsultantGuestInviteStatus;
  createdBy: Types.ObjectId;
  lastUsedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IConsultantMarriageParty {
  partyType: ConsultantMarriagePartyType;
  candidate?: Types.ObjectId;
  guestInvite?: Types.ObjectId;
  displayName?: string;
  contact?: string;
}

export interface IConsultantMarriageRecord extends Document {
  consultant: Types.ObjectId;
  case?: Types.ObjectId;
  parties: IConsultantMarriageParty[];
  marriedAt: Date;
  note?: string;
  rishtaProgress?: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICreateConsultantAssignmentPayload {
  candidateId: string;
  note?: string;
}

export interface IAvailableConsultantsQuery {
  candidateId: string;
}

export interface IConsultantAssignmentListQuery {
  candidateId?: string;
  status?: ConsultantAssignmentStatus;
}

export interface IStartConsultationCasePayload {
  candidateId: string;
  consultantId: string;
  note?: string;
  title?: string;
}

export interface ICreateConsultationCasePayload {
  candidateIds: string[];
  note?: string;
  title?: string;
}

export interface IConsultationCaseListQuery {
  candidateId?: string;
  status?: ConsultationCaseStatus;
}

export interface IAddCaseCandidatePayload {
  candidateId: string;
}

export interface ICreateCandidateInvitePayload {
  candidateId: string;
}

export interface ISendConsultationMessagePayload {
  candidateId?: string;
  message: string;
}

export interface IConsultationMessagesQuery {
  limit?: number;
  page?: number;
}

export interface ICreateGuestInvitePayload {
  contact?: string;
  displayName: string;
  expiresAt?: Date;
}

export interface ICreateConsultantMarriageRecordPayload {
  caseId?: string;
  marriedAt?: Date;
  note?: string;
  parties: {
    candidateId?: string;
    contact?: string;
    displayName?: string;
    guestInviteId?: string;
    partyType: ConsultantMarriagePartyType;
  }[];
}

export interface IConsultantMarriageRecordListQuery {
  caseId?: string;
  limit?: number;
  page?: number;
}
