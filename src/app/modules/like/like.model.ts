import { Schema, model } from 'mongoose';
import { ILike, LikeType } from './like.interface';

const likeSchema = new Schema<ILike>(
  {
    likedBy: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true },
    likedProfile: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true },
    type: { type: String, enum: Object.values(LikeType), default: LikeType.LIKE },
  },
  { timestamps: true, versionKey: false }
);

const Like = model<ILike>('Like', likeSchema);

export default Like;
