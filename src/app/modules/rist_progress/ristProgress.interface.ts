import { Document, Types } from 'mongoose';

export interface IRistProgress extends Document {
  candidates: Types.ObjectId[];
  progressValue: number;
  completedSteps: string[];
}
