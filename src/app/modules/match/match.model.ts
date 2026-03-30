import { Schema, model } from 'mongoose';
import { IMatch } from './match.interface';

const matchSchema = new Schema<IMatch>(
  {
    candidates: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Candidate', required: true }],
      validate: [(arr: unknown[]) => Array.isArray(arr) && arr.length === 2, 'Exactly two candidates required'],
    },
  },
  { timestamps: true, versionKey: false }
);

const Match = model<IMatch>('match', matchSchema);

export default Match;
