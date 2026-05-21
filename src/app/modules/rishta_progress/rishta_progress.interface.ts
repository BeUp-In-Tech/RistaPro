import { Document, Types } from 'mongoose';
import { OccupationKey, ReligionKey } from '../../constant/constant';
import { Gender } from '../candidate/candidate.interface';
import { Role } from '../user/user.interface';

export enum RishtaProgressStep {
  MATCHES = 'MATCHES',
  START_CHAT = 'START_CHAT',
  PARENT_INVOLVES = 'PARENT_INVOLVES',
  SHAADI = 'SHAADI',
}

export enum RishtaProgressStatus {
  ACTIVE = 'ACTIVE',
  MARRIED = 'MARRIED',
}

export enum RishtaProgressStepSource {
  MATCH_CREATED = 'MATCH_CREATED',
  MATCH_CHAT_STARTED = 'MATCH_CHAT_STARTED',
  MESSAGE_REQUEST_ACCEPTED = 'MESSAGE_REQUEST_ACCEPTED',
  GUARDIAN_ACCEPTED = 'GUARDIAN_ACCEPTED',
  MARRIAGE_REQUEST_ACCEPTED = 'MARRIAGE_REQUEST_ACCEPTED',
  ADMIN_CONFIRMED = 'ADMIN_CONFIRMED',
}

export enum RishtaMarriageRequestStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export interface IRishtaProgressStepDetail {
  step: RishtaProgressStep;
  completedAt: Date;
  source: RishtaProgressStepSource;
  referenceId?: Types.ObjectId;
  completedBy?: Types.ObjectId;
}

export interface IRishtaProgress extends Document {
  candidates: Types.ObjectId[];
  pairKey: string;
  match?: Types.ObjectId;
  conversation?: Types.ObjectId;
  completedSteps: RishtaProgressStep[];
  progressValue: number;
  status: RishtaProgressStatus;
  stepDetails: IRishtaProgressStepDetail[];
  marriedAt?: Date;
  marriageConfirmedBy?: Types.ObjectId;
  consultantUser?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IRishtaMarriageApproval {
  candidate: Types.ObjectId;
  user: Types.ObjectId;
  linkedUser?: Types.ObjectId;
  respondedAt: Date;
}

export interface IRishtaMarriageRequest extends Document {
  pairKey: string;
  candidates: Types.ObjectId[];
  progress: Types.ObjectId;
  requestedByUser: Types.ObjectId;
  requestedByRole: Role;
  requestedByCandidate?: Types.ObjectId;
  requestedByLinkedUser?: Types.ObjectId;
  consultantUser?: Types.ObjectId;
  status: RishtaMarriageRequestStatus;
  approvals: IRishtaMarriageApproval[];
  rejectedByCandidate?: Types.ObjectId;
  rejectedByUser?: Types.ObjectId;
  rejectedAt?: Date;
  rejectReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IRishtaProgressQuery {
  candidateId: string;
  otherCandidateId?: string;
  matchId?: string;
  conversationId?: string;
  progressId?: string;
}

export interface IRishtaPairLocator {
  candidateId?: string;
  otherCandidateId?: string;
  matchId?: string;
  conversationId?: string;
  progressId?: string;
}

export interface ICreateMarriageRequestPayload extends IRishtaPairLocator {}

export interface IRespondMarriageRequestPayload {
  candidateId: string;
  rejectReason?: string;
}

export interface IAdminMarkMarriedPayload extends IRishtaPairLocator {}

export interface IMarriedListQuery {
  page: number;
  limit: number;
}

export interface IRishtaMarriageRequestListQuery {
  candidateId: string;
  limit: number;
  page: number;
  sort?: string;
  status?: RishtaMarriageRequestStatus;
}

export interface IRishtaMarriageRequestUserInfo {
  _id: Types.ObjectId;
  email?: string;
  full_name: string;
  phone?: string;
  picture?: string;
  role: Role;
}

export interface IRishtaMarriageRequestCandidateCard {
  _id: Types.ObjectId;
  age: number;
  gender: Gender;
  images: string[];
  livesIn?: string;
  name: string;
  occupation?: OccupationKey;
  religion?: ReligionKey;
}

export interface IRishtaMarriageRequestListItem {
  _id: Types.ObjectId;
  approvals: IRishtaMarriageApproval[];
  canRespond: boolean;
  candidates: Types.ObjectId[];
  createdAt?: Date;
  currentCandidateApproved: boolean;
  otherCandidate: IRishtaMarriageRequestCandidateCard | null;
  pairKey: string;
  progress: Types.ObjectId;
  requestedByCandidate: IRishtaMarriageRequestCandidateCard | null;
  requestedByRole: Role;
  requestedByUser: IRishtaMarriageRequestUserInfo | null;
  status: RishtaMarriageRequestStatus;
  updatedAt?: Date;
}

export interface IRishtaMarriageRequestListResponse {
  data: IRishtaMarriageRequestListItem[];
  meta: {
    limit: number;
    page: number;
    total: number;
    totalPage: number;
  };
}
