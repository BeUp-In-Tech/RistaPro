import { Document, Types } from 'mongoose';

export enum LikeType {
  LIKE = 'LIKE',
  SUPER_LIKE = 'SUPER_LIKE',
  PASS = 'PASS',
}

export interface ILike extends Document {
  likedBy: Types.ObjectId;
  likedProfile: Types.ObjectId;
  type: LikeType;
}
