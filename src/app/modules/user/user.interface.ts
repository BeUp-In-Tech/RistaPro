
import { Types } from 'mongoose';

export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
  CONSULTANT = 'CONSULTANT',
}

export enum ActiveStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  BLOCKED = 'BLOCKED',
}

export interface IAuthProvider {
  provider: string;
  providerId: string;
}

export interface IUser {
  _id?: Types.ObjectId;
  full_name: string;
  email: string;
  password?: string;
  picture?: string;
  plan?: string;
  dailyLikeRemaining?: number;
  superLikeRemaining?: number;
  lastLikeReset?: Date;
  isVerified?: boolean;
  isDeleted?: boolean;
  isActive?: ActiveStatus;
  role: Role;
  auths?: IAuthProvider[];
  deviceTokens?: string[];
}
