import { Schema, model } from 'mongoose';
import { INotification, INotificationPreference, NotificationChannel, NotificationType } from './notification.interface';

const notificationSchema = new Schema<INotification>(
  {
    candidate: { type: Schema.Types.ObjectId, ref: 'candidate', required: true },
    type: { type: String, enum: Object.values(NotificationType), required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId },
    entityURL: { type: String },
    deepLink: { type: String },
    isSeen: { type: Boolean, default: false },
    data: { type: Schema.Types.Mixed },
  },
  { timestamps: true, versionKey: false }
);

const preferenceSchema = new Schema<INotificationPreference>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    channel: { type: String, enum: Object.values(NotificationChannel), default: NotificationChannel.ALL },
    push_user_reports: { type: Boolean, default: true },
    push_user_registration: { type: Boolean, default: true },
    email_user_reports: { type: Boolean, default: true },
    email_user_registration: { type: Boolean, default: true },
    payment_transaction: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

export const Notification = model<INotification>('notification', notificationSchema);
export const NotificationPreference = model<INotificationPreference>('notificationPreference', preferenceSchema);

export default Notification;
