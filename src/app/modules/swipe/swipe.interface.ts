import { Types } from 'mongoose';
import {
  CastKey,
  ChildrenKey,
  DrinkStatusKey,
  HighestEducationKey,
  InterestKey,
  MoveAbroadKey,
  OccupationKey,
  PersonalityKey,
  RelationshipStatusKey,
  ReligionKey,
  SectKey,
  SmokeStatusKey,
} from '../../constant/constant';
import {
  Gender,
  IVerificationStatus,
} from '../candidate/candidate.interface';
import { LikeSource, LikeType } from '../like/like.interface';
import { MatchStatus } from '../match/match.interface';
import { ActiveStatus } from '../user/user.interface';

export interface ISwipeFeedQuery {
  candidateId: string;
  cursor?: string;
  limit: number;
}

export interface ISwipeFeedCursor {
  offset: number;
  sessionId: string;
}

export interface ISwipeFeedSession {
  candidateIds: string[];
  createdAt: string;
  relaxed: boolean;
  relaxedReason?: string;
}

export interface ISwipeFeedCandidateLean {
  _id: Types.ObjectId;
  address?: string;
  bio?: string;
  caste?: CastKey;
  coordinates?: number[];
  createdAt?: Date;
  dateOfBirth: Date;
  drink_status?: DrinkStatusKey;
  gender: Gender;
  have_children?: ChildrenKey;
  height?: number;
  highest_education?: HighestEducationKey;
  images?: string[];
  interests?: InterestKey[];
  isActive: ActiveStatus;
  move_abroad?: MoveAbroadKey;
  name: string;
  occupation?: OccupationKey;
  personality?: PersonalityKey[];
  profile_assist?: string;
  relationship_status?: RelationshipStatusKey;
  religion?: ReligionKey;
  sect?: SectKey;
  smoke_status?: SmokeStatusKey;
  updatedAt?: Date;
  user:
    | Types.ObjectId
    | {
        _id: Types.ObjectId;
        isActive?: ActiveStatus;
        isDeleted?: boolean;
        isVerified?: boolean;
      }
    | null;
  verification_status?: IVerificationStatus;
}

export interface ISwipeFeedScore {
  matchScore: number;
  scoreReasons: string[];
}

export interface ISwipeFeedCard extends ISwipeFeedScore {
  _id: Types.ObjectId;
  address?: string;
  age: number;
  bio?: string;
  caste?: CastKey;
  createdAt?: Date;
  drink_status?: DrinkStatusKey;
  gender: Gender;
  have_children?: ChildrenKey;
  height?: number;
  highest_education?: HighestEducationKey;
  images: string[];
  interests: InterestKey[];
  isSuperLike: boolean;
  labels: Record<string, unknown>;
  move_abroad?: MoveAbroadKey;
  name: string;
  occupation?: OccupationKey;
  personality: PersonalityKey[];
  relationship_status?: RelationshipStatusKey;
  religion?: ReligionKey;
  sect?: SectKey;
  smoke_status?: SmokeStatusKey;
}

export interface ISwipeFeedResponse {
  cards: ISwipeFeedCard[];
  limit: number;
  nextCursor: string | null;
  relaxed: boolean;
  relaxedReason?: string;
}

export interface ISwipeActionPayload {
  candidateId: string;
  source: LikeSource;
  targetCandidateId: string;
  type: LikeType;
}

export interface ISwipeActionResponse {
  action: {
    _id: Types.ObjectId;
    actedBy?: Types.ObjectId;
    isActive: boolean;
    likedBy: Types.ObjectId;
    likedProfile: Types.ObjectId;
    source: LikeSource;
    type: LikeType;
    createdAt?: Date;
    updatedAt?: Date;
  };
  match: {
    _id: Types.ObjectId;
    candidates: Types.ObjectId[];
    conversation?: Types.ObjectId;
    matchedBy?: Types.ObjectId;
    pairKey: string;
    status: MatchStatus;
    createdAt?: Date;
    updatedAt?: Date;
  } | null;
  matched: boolean;
  quota: {
    dailyLikeRemaining: number;
    nextResetAt: Date;
    superLikeRemaining: number;
  };
}
