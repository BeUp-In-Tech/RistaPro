import { Document, Types } from 'mongoose';
import { Gender } from '../candidate/candidate.interface';

export enum MatchStatus {
  ACTIVE = 'ACTIVE',
  UNMATCHED = 'UNMATCHED',
  BLOCKED = 'BLOCKED',
}

export interface IMatch extends Document {
  candidates: Types.ObjectId[];
  conversation?: Types.ObjectId;
  matchedBy?: Types.ObjectId;
  pairKey: string;
  status: MatchStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TMatchWithCandidateIds {
  _id: Types.ObjectId;
  candidates: Types.ObjectId[];
  conversation?: Types.ObjectId;
  matchedBy?: Types.ObjectId;
  pairKey: string;
  status: MatchStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TMatchCandidateLean {
  _id: Types.ObjectId;
  address?: string;
  dateOfBirth: Date;
  gender: Gender;
  images?: string[];
  name: string;
  religion?: string;
}

export interface TPopulatedMatchLean extends Omit<
  TMatchWithCandidateIds,
  'candidates'
> {
  candidates: TMatchCandidateLean[];
}
