import { Schema, model } from 'mongoose';
import { IRistProgress } from './ristProgress.interface';

const ristProgressSchema = new Schema<IRistProgress>(
  {
    candidates: [{ type: Schema.Types.ObjectId, ref: 'candidate', required: true }],
    progressValue: { type: Number, default: 0 },
    completedSteps: [{ type: String }],
  },
  { timestamps: true, versionKey: false }
);

const RistProgress = model<IRistProgress>('ristProgress', ristProgressSchema);

export default RistProgress;
