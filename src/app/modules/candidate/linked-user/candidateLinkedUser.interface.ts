import { Document, Types } from 'mongoose';
import { TLinkedUserSafeUser } from './candidateLinkedUser.utility';
import { ICandidateProfileFields, RelationToUser } from '../candidate.interface';
import { ActiveStatus } from '../../user/user.interface';



export enum CandidateLinkedUserRelation {
  SELF = 'SELF',
  FATHER = 'FATHER',
  MOTHER = 'MOTHER',
  BROTHER = 'BROTHER',
  SISTER = 'SISTER',
  GUARDIAN = 'GUARDIAN',
  RELATIVE = 'RELATIVE',
  CONSULTANT = 'CONSULTANT',
  OTHER = 'OTHER',
}

export enum CandidateLinkedUserAccessRole {
  OWNER = 'OWNER',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

export enum CandidateLinkedUserStatus {
  ACTIVE = 'ACTIVE',
  REMOVED = 'REMOVED',
}

export enum CandidateManagementMode {
  SELF_MANAGED = 'SELF_MANAGED',
  PARENT_ASSISTED = 'PARENT_ASSISTED',
  FAMILY_ASSISTED = 'FAMILY_ASSISTED',
  CONSULTANT_ASSISTED = 'CONSULTANT_ASSISTED',
  MIXED_ASSISTED = 'MIXED_ASSISTED',
}

export interface ICandidateManagementSummary {
  mode: CandidateManagementMode;
  activeLinkedUserCount: number;
  ownerCount: number;
  hasSelfManager: boolean;
  hasParentManager: boolean;
  hasConsultantManager: boolean;
}

export interface ICandidateLinkedUser extends Document {
  candidate: Types.ObjectId;
  user: Types.ObjectId;
  name: string,
  relationshipToCandidate: CandidateLinkedUserRelation;
  accessRole: CandidateLinkedUserAccessRole;
  status: CandidateLinkedUserStatus;
  isPrimary: boolean;
  linkedBy: Types.ObjectId;
  joinedAt?: Date;
  removedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICreateCandidateLinkedUserPayload {
  name: string;
  email: string;
  password?: string;
  relationshipToCandidate: CandidateLinkedUserRelation;
  accessRole?: CandidateLinkedUserAccessRole;
  isPrimary?: boolean;
}

export interface IUpdateCandidateLinkedUserPayload {
  name?: string;
  relationshipToCandidate?: CandidateLinkedUserRelation;
  accessRole?: CandidateLinkedUserAccessRole;
  isPrimary?: boolean;
}




// -------------HELPER----------------------
export const CANDIDATE_LINKED_USER_SORT_PRIORITY: Record<
  CandidateLinkedUserAccessRole,
  number
> = {
  [CandidateLinkedUserAccessRole.OWNER]: 0,
  [CandidateLinkedUserAccessRole.EDITOR]: 1,
  [CandidateLinkedUserAccessRole.VIEWER]: 2,
};

export interface TLegacyCandidateAccessSeed  {
  _id: Types.ObjectId;
  name?: string;
  user: Types.ObjectId;
  relationToUser?: RelationToUser;
  isActive: ActiveStatus;
};

export interface TActiveLinkedUserLean  {
  _id: Types.ObjectId;
  candidate: Types.ObjectId;
  user: Types.ObjectId;
  relationshipToCandidate: CandidateLinkedUserRelation;
  accessRole: CandidateLinkedUserAccessRole;
  status: CandidateLinkedUserStatus;
  isPrimary: boolean;
  linkedBy: Types.ObjectId;
  joinedAt?: Date;
  removedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TActiveLinkedUserWithUser = Omit<TActiveLinkedUserLean, 'user'> & {
  user: TLinkedUserSafeUser | null;
};

export type TCandidateProfileLean = Partial<ICandidateProfileFields> & {
  _id: Types.ObjectId;
  name: string;
  dateOfBirth: Date;
  gender: string;
  images?: string[];
  relationToUser?: RelationToUser;
  isActive?: ActiveStatus
  updatedAt?: Date;
};

export type TMyLinkedCandidateRow = Omit<TActiveLinkedUserLean, 'candidate'> & {
  candidate: TCandidateProfileLean | null;
};

export type TLinkedUserAccessResponseShape = Pick<
  TActiveLinkedUserLean,
  | '_id'
  | 'accessRole'
  | 'relationshipToCandidate'
  | 'status'
  | 'isPrimary'
  | 'linkedBy'
  | 'joinedAt'
>;
