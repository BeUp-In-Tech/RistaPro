import { Schema, model } from 'mongoose';
import { INotification, INotificationPreference, NotificationType } from './notification.interface';
import { Role } from '../user/user.interface';

const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    type: { type: String, enum: Object.values(NotificationType), required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId },
    webUrl: { type: String },
    deepLink: { type: String },
    isSeen: { type: Boolean, default: false },
    data: { type: Schema.Types.Mixed },
  },
  { timestamps: true, versionKey: false }
);

notificationSchema.index({ user: 1, isSeen: 1, createdAt: -1 });

const preferenceSchema = new Schema<INotificationPreference>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    channel: {
      push: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      all: { type: Boolean, default: true },
    },     role: { type: String, enum: Object.values(Role), default: Role.USER, required: true },
    push_user_reports: { type: Boolean, default: true },
    push_user_registration: { type: Boolean, default: true },
    email_user_reports: { type: Boolean, default: true },
    email_user_registration: { type: Boolean, default: true },
    payment_transaction: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

preferenceSchema.index({ user: 1, role: 1 }, { unique: true });
export const Notification = model<INotification>('notification', notificationSchema);
export const NotificationPreference = model<INotificationPreference>('notificationPreference', preferenceSchema);

export default Notification;
