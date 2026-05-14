import { Document, Types } from 'mongoose';

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
