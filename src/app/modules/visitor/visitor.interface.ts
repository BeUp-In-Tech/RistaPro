import { Document, Types } from 'mongoose';
import { OccupationKey, ReligionKey } from '../../constant/constant';
import { Gender } from '../candidate/candidate.interface';

export interface IVisitor extends Document {
  createdAt?: Date;
  lastVisitedAt: Date;
  visitCount: number;
  visitedBy: Types.ObjectId;
  visitedProfile: Types.ObjectId;
}

export interface ITrackProfileVisitPayload {
  candidateId: string;
  visitedProfileId: string;
}

export interface IProfileVisitorListQuery {
  candidateId: string;
  limit: number;
  page: number;
}

export interface IProfileVisitorCard {
  _id: Types.ObjectId;
  age: number;
  badge: boolean;
  gender: Gender;
  images: string[];
  labels: {
    occupation?: string;
    religion?: string;
  };
  lastVisitedAt: Date;
  livesIn?: string;
  name: string;
  occupation?: OccupationKey;
  religion?: ReligionKey;
  visitCount: number;
}

export interface IProfileVisitorListResponse {
  data: IProfileVisitorCard[];
  meta: {
    limit: number;
    page: number;
    total: number;
    totalPage: number;
  };
}
