import mongoose, { Schema } from 'mongoose';
import {
  ActiveStatus,
  IAuthProvider,
  IFcmToken,
  IPlatform,
  IUser,
  Role,
} from './user.interface';
import bcrypt from 'bcrypt';
import env from '../../config/env';

const authProviderSchema = new Schema<IAuthProvider>(
  {
    provider: { type: String, required: true },
    providerId: { type: String, required: true },
  },
  { _id: false, versionKey: false }
);

const deviceTokenSchema = new Schema<IFcmToken>(
  {
    deviceId: { type: String, required: true, trim: true },
    platform: { type: String, enum: Object.values(IPlatform), required: true },
    token: { type: String, required: true, trim: true },
    deviceName: { type: String, default: '' },
    lastSeenAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { _id: false, versionKey: false }
);

const userSchema = new Schema<IUser>(
  {
    full_name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String },
    phone: { type: String, trim: true },
    picture: { type: String, trim: true },
    plan: { type: String, trim: true },
    isVerified: { type: Boolean, default: env.NODE_ENV === 'development' },
    isDeleted: { type: Boolean, default: false },
    isActive: {
      type: String,
      enum: Object.values(ActiveStatus),
      default: ActiveStatus.ACTIVE,
    },
    role: { type: String, enum: Object.values(Role), default: Role.USER },
    auths: { type: [authProviderSchema], default: [] },
    deviceTokens: { type: [deviceTokenSchema], default: [] },
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
      parseInt(env.BCRYPT_SALT_ROUND) || 10
    );
    this.password = hashedPassword;
  }
});

userSchema.index({ role: 1, isDeleted: 1, createdAt: -1 });
userSchema.index({ 'deviceTokens.token': 1 });
userSchema.index({ 'deviceTokens.deviceId': 1 });



const User = mongoose.model<IUser>('user', userSchema);

export default User;
