import { NotificationPreference } from './notification.model';
import { Role } from '../user/user.interface';

export const ensureNotificationPreference = async (
  userId: string,
  role: Role = Role.USER
) => {
  const isPreferenceExists = await NotificationPreference.exists({ user: userId });

  if (isPreferenceExists) {
    return;
  }

  return await NotificationPreference.create({
    user: userId,
    channel: {
      push: true,
      email: true,
      all: true,
    },
    role,
    push_user_reports: true,
    push_user_registration: true,
    email_user_reports: true,
    email_user_registration: true,
    payment_transaction: true,
  });
};
