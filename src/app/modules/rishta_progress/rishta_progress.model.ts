import { Schema, model } from 'mongoose';
import { IRishtaProgress } from './rishta_progress.interface';

const ristProgressSchema = new Schema<IRishtaProgress>(
  {
    candidates: {
      type: [{ type: Schema.Types.ObjectId, ref: 'candidate' }],
      validate: {
        validator: (v: unknown[]) => v.length > 0,
        message: 'At least one candidate is required',
      },
    },    progressValue: { type: Number, default: 0 },
    completedSteps: [{ type: String }],
  },
  { timestamps: true, versionKey: false }
);

const RistProgress = model<IRishtaProgress>('ristProgress', ristProgressSchema);

export default RistProgress;
