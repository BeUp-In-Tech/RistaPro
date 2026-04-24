import { Schema, model } from 'mongoose';
import { IMatch, MatchStatus } from './match.interface';

const matchSchema = new Schema<IMatch>(
  {
    candidates: {
      type: [{ type: Schema.Types.ObjectId, ref: 'candidate', required: true }],
      validate: [(arr: unknown[]) => Array.isArray(arr) && arr.length === 2, 'Exactly two candidates required'],
    },
    conversation: { type: Schema.Types.ObjectId, ref: 'conversation' },
    matchedBy: { type: Schema.Types.ObjectId, ref: 'candidate' },
    pairKey: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(MatchStatus),
      default: MatchStatus.ACTIVE,
    },
  },
  { timestamps: true, versionKey: false }
);

// pairKey is sorted candidate ids, so concurrent mutual likes return one match.
matchSchema.index(
  { pairKey: 1 },
  {
    unique: true,
    partialFilterExpression: { pairKey: { $type: 'string' } },
  }
);
matchSchema.index({ candidates: 1, status: 1, updatedAt: -1 });

const Match = model<IMatch>('match', matchSchema);

export default Match;
