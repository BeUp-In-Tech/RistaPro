import { Document, Types } from 'mongoose';
import { Role } from '../user/user.interface';

export enum NotificationType {
  MATCH = 'MATCH',
  CALL = 'CALL',
  MESSAGE = 'MESSAGE',
  SYSTEM = 'SYSTEM',
  REMINDER = 'REMINDER',
}

export interface INotification extends Document {
  candidate: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  entityId?: Types.ObjectId;
  entityURL?: string;
  deepLink?: string;
  isSeen: boolean;
  data?: Record<string, unknown>;
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
