import { Schema, model } from 'mongoose';
import { ILike, LikeSource, LikeType } from './like.interface';

const likeSchema = new Schema<ILike>(
  {
    actedBy: { type: Schema.Types.ObjectId, ref: 'user' },
    isActive: { type: Boolean, default: true },
    likedBy: { type: Schema.Types.ObjectId, ref: 'candidate', required: true },
    likedProfile: { type: Schema.Types.ObjectId, ref: 'candidate', required: true },
    source: {
      type: String,
      enum: Object.values(LikeSource),
      default: LikeSource.FEED,
    },
    type: { type: String, enum: Object.values(LikeType), default: LikeType.LIKE },
  },
  { timestamps: true, versionKey: false }
);

// One active swipe decision per candidate pair keeps retries idempotent.
likeSchema.index({ likedBy: 1, likedProfile: 1 }, { unique: true });
likeSchema.index({ likedProfile: 1, type: 1, createdAt: -1 });
likeSchema.index({ likedBy: 1, type: 1, createdAt: -1 });

const Like = model<ILike>('Like', likeSchema);

export default Like;
