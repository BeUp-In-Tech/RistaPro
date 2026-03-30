import mongoose, { Schema } from 'mongoose';
import { ActiveStatus, IAuthProvider, IUser, Role } from './user.interface';
import bcrypt from 'bcrypt';
import env from '../../config/env';

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
    password: { type: String },
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
    deviceTokens: { type: [String] }
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

// Hashed password
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;  // Only hash the password if it has been modified
  
  if (this.password) {
    const hashedPassword = await bcrypt.hash(
      this.password,
      parseInt(env.BCRYPT_SALT_ROUND)
    );
    this.password = hashedPassword;
  }
});



const User = mongoose.model<IUser>('user', userSchema);

export default User;
