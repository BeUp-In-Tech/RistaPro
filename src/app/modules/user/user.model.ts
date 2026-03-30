import mongoose, { Schema } from 'mongoose';
import { ActiveStatus, IAuthProvider, IUser, Role } from './user.interface';

const authProviderSchema = new Schema<IAuthProvider>(
  {
    provider: { type: String, required: true },
    providerId: { type: String, required: true },
  },
  { _id: false, versionKey: false }
);

const userSchema = new Schema<IUser>(
  {
    full_name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    picture: { type: String },
    plan: { type: String },
    dailyLikeRemaining: { type: Number, default: 0 },
    superLikeRemaining: { type: Number, default: 0 },
    lastLikeReset: { type: Date },
    isVerified: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    isActive: {
      type: String,
      enum: Object.values(ActiveStatus),
      default: ActiveStatus.ACTIVE,
    },
    role: { type: String, enum: Object.values(Role), default: Role.USER },
    auths: { type: [authProviderSchema], default: [] },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);


const User = mongoose.model<IUser>('user', userSchema);

export default User;
