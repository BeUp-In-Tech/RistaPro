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

// VERIFICATION DETAIL
export interface IVerificationDetail {
  status: VerificationState;
  date?: Date;
  success?: boolean;
  device?: string;
}

// VERIFICATION STATUS
export interface IVerificationStatus {
  face_verified: IVerificationDetail;
  id_verified: IVerificationDetail;
  parent_verified: IVerificationDetail;
  education_verified: IVerificationDetail;
  admin_verified: IVerificationDetail;
}

// CANDIDATE INTERFACE
export interface ICandidate extends Document {
  user: Types.ObjectId;
  name: string;
  dateOfBirth: Date;
  gender: Gender;
  height?: number;
  religion?: ReligionKey;
  sect?: SectKey;
  cast?: CastKey;
  caste?: string;
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
  relationToUser?: string;
  partnerExpectation?: string;
  bio?: string;
  image?: string[];
  face_verify_logs?: IVerificationDetail[];
  address?: string;
  coordinates?: number[];
  verification_status?: IVerificationStatus;
  isActive: ActiveStatus;
}
