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
import { Gender, IVerificationStatus } from '../candidate/candidate.interface';
import { LikeSource, LikeType } from '../like/like.interface';
import { MatchStatus } from '../match/match.interface';
import { ActiveStatus } from '../user/user.interface';
import { PlanKey } from '../plan/plan.interface';

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

export interface ISwipeFeedCard {
  _id: Types.ObjectId;
  age: number;
  gender: Gender;
  images: string[];
  labels: Record<string, unknown>;
  livesIn?: string;
  distanceKm?: number;
  matchScore: number;
  name: string;
  personality: PersonalityKey[];
  religion?: ReligionKey;
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

export interface TSwipeActionLean {
  _id: Types.ObjectId;
  actedBy?: Types.ObjectId;
  isActive: boolean;
  likedBy: Types.ObjectId;
  likedProfile: Types.ObjectId;
  source: LikeSource;
  type: LikeType;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TSwipeMatchLean {
  _id: Types.ObjectId;
  candidates: Types.ObjectId[];
  conversation?: Types.ObjectId;
  matchedBy?: Types.ObjectId;
  pairKey: string;
  status: MatchStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TSwipeQuotaCandidate {
  _id: Types.ObjectId;
  plan?: PlanKey;
  user:
    | Types.ObjectId
    | {
        _id: Types.ObjectId;
        isActive?: ActiveStatus;
        isDeleted?: boolean;
      }
    | null;
}

export interface TSwipePlanQuota {
  dailyLikes: number;
  superLikes: number;
}

export interface TSwipeActionLock {
  key: string;
  token: string;
}
