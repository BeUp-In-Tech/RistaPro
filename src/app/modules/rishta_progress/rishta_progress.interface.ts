import { Document, Types } from 'mongoose';

export interface IRishtaProgress extends Document {
  candidates: Types.ObjectId[];
  progressValue: number;
  completedSteps: string[];
}
