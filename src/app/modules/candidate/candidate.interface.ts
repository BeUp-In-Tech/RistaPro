import { Document, Types } from 'mongoose';
import { ActiveStatus } from '../user/user.interface';
import {
  ReligionKey,
  SectKey,
  CastKey,
  RelationshipStatusKey,
  ChildrenKey,
  MoveAbroadKey,
  HighestEducationKey,
  SmokeStatusKey,
  DrinkStatusKey,
  InterestKey,
  PersonalityKey,
} from '../../constant/constant';

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export enum VerificationState {
  NONE = 'NONE',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum RelationToUser {
  SELF = 'SELF',
  FATHER = 'FATHER',
  MOTHER = 'MOTHER',
  BROTHER = 'BROTHER',
  SISTER = 'SISTER',
  GUARDIAN = 'GUARDIAN',
  RELATIVE = 'RELATIVE',
  CONSULTANT = 'CONSULTANT',
  OTHER = 'OTHER',
  OTHERS = 'OTHERS',
}

// Snapshot of a single verification step.
export interface IVerificationDetail {
  status: VerificationState;
  date?: Date;
  success?: boolean;
  device?: string;
}

// Current verification state for each profile verification flow.
export interface IVerificationStatus {
  face_verified: IVerificationDetail;
  id_verified: IVerificationDetail;
  parent_verified: IVerificationDetail;
  education_verified: IVerificationDetail;
  admin_verified: IVerificationDetail;
}

// Fields that a client is allowed to send while creating or updating a profile.
export interface ICandidateProfileFields {
  name: string;
  dateOfBirth: Date;
  gender: Gender;
  height?: number;
  religion?: ReligionKey;
  sect?: SectKey;
  caste?: CastKey;
  profile_assist?: string;
  relationship_status?: RelationshipStatusKey;
  have_children?: ChildrenKey;
  move_abroad?: MoveAbroadKey;
  occupation?: string;
  highest_education?: HighestEducationKey;
  smoke_status?: SmokeStatusKey;
  drink_status?: DrinkStatusKey;
  interests?: InterestKey[];
  personality?: PersonalityKey[];
  // This is kept for request compatibility and now represents
  // the creator's relation to the candidate profile.
  relationToUser?: RelationToUser;
  partnerExpectation?: string;
  bio?: string;
  images?: string[];
  address?: string;
  coordinates?: number[];
}

export type ICreateCandidatePayload = ICandidateProfileFields;

export type IUpdateCandidatePayload = Partial<ICandidateProfileFields>;

// Stored candidate document with system-managed fields.
export interface ICandidate extends Document, ICandidateProfileFields {
  user: Types.ObjectId;
  face_verify_logs?: IVerificationDetail[];
  verification_status?: IVerificationStatus;
  isActive: ActiveStatus;
}
