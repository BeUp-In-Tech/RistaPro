import { Document, Types } from 'mongoose';

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

export enum NotificationChannel {
  PUSH = 'PUSH',
  EMAIL = 'EMAIL',
  ALL = 'ALL',
}

export interface INotificationPreference extends Document {
  user: Types.ObjectId;
  channel: NotificationChannel;
  push_user_reports: boolean;
  push_user_registration: boolean;
  email_user_reports: boolean;
  email_user_registration: boolean;
  payment_transaction: boolean;
}
