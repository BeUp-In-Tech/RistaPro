import { Document, Types } from 'mongoose';
import { Gender } from '../candidate/candidate.interface';
import { ReligionKey } from '../../constant/constant';
import { ActiveStatus } from '../user/user.interface';

export enum LikeType {
  LIKE = 'LIKE',
  SUPER_LIKE = 'SUPER_LIKE',
  PASS = 'PASS',
}

export enum LikeSource {
  FEED = 'FEED',
  LIKES_ME = 'LIKES_ME',
  PROFILE = 'PROFILE',
}

export interface ILike extends Document {
  actedBy?: Types.ObjectId;
  isActive: boolean;
  likedBy: Types.ObjectId;
  likedProfile: Types.ObjectId;
  source: LikeSource;
  type: LikeType;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ILikeListQuery {
  candidateId: string;
  limit: number;
  page: number;
  sort?: string;
  type?: LikeType.LIKE | LikeType.SUPER_LIKE;
}

export interface ILikeCandidateCard {
  _id: Types.ObjectId;
  age: number;
  gender: Gender;
  images: string[];
  livesIn?: string;
  name: string;
  religion?: ReligionKey;
}

export interface ILikeListItem {
  _id: Types.ObjectId;
  candidate: ILikeCandidateCard;
  createdAt?: Date;
  source: LikeSource;
  type: LikeType;
}

export interface ILikeListResponse {
  data: ILikeListItem[];
  meta: {
    limit: number;
    page: number;
    total: number;
    totalPage: number;
  };
}

export interface TLikeWithCandidate {
  _id: Types.ObjectId;
  createdAt?: Date;
  likedBy: Types.ObjectId | TLikeCandidateLean | null;
  likedProfile: Types.ObjectId | TLikeCandidateLean | null;
  source: ILike['source'];
  type: LikeType;
}

export interface TLikeCandidateLean {
  _id: Types.ObjectId;
  address?: string;
  dateOfBirth: Date;
  gender: ILikeCandidateCard['gender'];
  images?: string[];
  isActive: ActiveStatus;
  name: string;
  religion?: ILikeCandidateCard['religion'];
  user:
    | Types.ObjectId
    | {
        _id: Types.ObjectId;
        isActive?: ActiveStatus;
        isDeleted?: boolean;
        isVerified?: boolean;
      }
    | null;
}
