
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

export enum IPlatform {
    WEB = 'WEB',
    IOS = 'IOS',
    ANDROID = 'ANDROID'
}

export interface IFcmToken {
  deviceId: string;
  platform: IPlatform;
  token: string;
  deviceName?: string;
  lastSeenAt?: Date;
  isActive?: boolean;
}

export interface IUser {
  _id?: Types.ObjectId;
  full_name: string;
  email: string;
  password?: string;
  phone?: string;
  picture?: string;
  plan?: string;
  isVerified?: boolean;
  isDeleted?: boolean;
  isActive?: ActiveStatus;
  role: Role;
  auths?: IAuthProvider[];
  deviceTokens?: IFcmToken[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICreateConsultantPayload {
  full_name: string;
  email: string;
  password: string;
  phone?: string;
  picture?: string;
  plan?: string;
  isVerified?: boolean;
  isActive?: ActiveStatus;
}

export interface IUpdateProfilePayload {
  full_name?: string;
  picture?: string;
}

export interface IAdminUpdateUserPayload {
  full_name?: string;
  picture?: string;
  plan?: string;
  isVerified?: boolean;
  isActive?: ActiveStatus;
  isDeleted?: boolean;
}
