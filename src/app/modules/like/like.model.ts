import { Schema, model } from 'mongoose';
import { ILike, LikeType } from './like.interface';

const likeSchema = new Schema<ILike>(
  {
    likedBy: { type: Schema.Types.ObjectId, ref: 'candidate', required: true },
    likedProfile: { type: Schema.Types.ObjectId, ref: 'candidate', required: true },
    type: { type: String, enum: Object.values(LikeType), default: LikeType.LIKE },
  },
  { timestamps: true, versionKey: false }
);

likeSchema.index({ likedBy: 1, likedProfile: 1 });

const Like = model<ILike>('Like', likeSchema);

export default Like;
