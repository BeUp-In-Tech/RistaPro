import { Document, Types } from 'mongoose';

export enum CallType {
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
}

export enum CallStatus {
  INITIATED = 'INITIATED',
  ACTIVE = 'ACTIVE',
  MISSED = 'MISSED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
}

export interface ICall extends Document {
  matchId?: Types.ObjectId;
  callerCandidate: Types.ObjectId;
  receiverCandidate: Types.ObjectId;
  type: CallType;
  status: CallStatus;
  startedAt?: Date;
  endedAt?: Date;
}