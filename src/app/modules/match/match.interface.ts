import { Document, Types } from 'mongoose';

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
