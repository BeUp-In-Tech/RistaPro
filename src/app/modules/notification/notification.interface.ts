import { Document, Types } from 'mongoose';
import { Role } from '../user/user.interface';

export enum NotificationType {
  MATCH = 'MATCH',
  CALL = 'CALL',
  MESSAGE = 'MESSAGE',
  MARRIAGE_REQUEST = 'MARRIAGE_REQUEST',
  SYSTEM = 'SYSTEM',
  REMINDER = 'REMINDER',
}

export interface INotificationPayload {
  user: Types.ObjectId | string;
  type: NotificationType;
  title: string;
  body: string;
  entityId?: Types.ObjectId;
  webUrl?: string;
  deepLink?: string;
  data?: Record<string, unknown>;
}

export interface INotification extends Document, INotificationPayload {
  user: Types.ObjectId;
  isSeen: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface INotificationListQuery {
  page: number;
  limit: number;
  isSeen?: boolean;
}

export interface NotificationChannel {
  push: boolean,
  email: boolean,
  all: boolean
}

export interface INotificationPreference extends Document {
  user: Types.ObjectId;
  channel: NotificationChannel;
  role: Role,
  push_user_reports: boolean;
  push_user_registration: boolean;
  email_user_reports: boolean;
  email_user_registration: boolean;
  payment_transaction: boolean;
}
