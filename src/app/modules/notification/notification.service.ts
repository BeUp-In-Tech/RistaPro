/* eslint-disable no-console */
import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import admin from '../../config/firebase.admin';
import AppError from '../../errorHelpers/AppError';
import User from '../user/user.model';
import { IUser, Role } from '../user/user.interface';
import { INotification } from './notification.interface';
import Notification, { NotificationPreference } from './notification.model';

export const ensureNotificationPreference = async (
  userId: string,
  role: Role = Role.USER
) => {
  // Create default notification settings only once per user (upsert avoids race).
  return await NotificationPreference.findOneAndUpdate(
    { user: userId },
    {
      $setOnInsert: {
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
      },
    },
    { upsert: true, new: true }
  );
};
/* eslint-disable @typescript-eslint/no-explicit-any */

// Remove dead device tokens so later sends stay clean.
async function cleanupInvalidTokens(params: {
  userId: mongoose.Types.ObjectId;
  invalidTokens: string[];
}) {
  const { userId, invalidTokens } = params;
  if (!invalidTokens.length) return;

  const cleanupResult = await User.updateOne(
    { _id: userId },
    { $pull: { deviceTokens: { token: { $in: invalidTokens } } } }
  );

  console.warn('[notification] removed invalid firebase tokens', {
    userId: userId.toString(),
    invalidTokenCount: invalidTokens.length,
    modifiedCount: cleanupResult.modifiedCount,
  });
}


// Collect only active, valid, unique device tokens.
function getActiveTokens(
  userDoc: Pick<IUser, 'deviceTokens'> | null
): string[] {
  if (!userDoc?.deviceTokens?.length) return [];

  const uniqueTokens = new Set<string>();

  for (const device of userDoc.deviceTokens) {
    if (!device) continue;

    // must be active
    if (!device.isActive) continue;


    // validate token
    if (typeof device.token !== 'string') continue;
    if (device.token.trim().length < 10) continue;

    uniqueTokens.add(device.token.trim());
  }

  return Array.from(uniqueTokens);
}

// FCM data payloads must contain string values only.
function serializeNotificationData(
  data?: Record<string, unknown>
): Record<string, string> {
  if (!data) return {};

  return Object.entries(data).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value === undefined || value === null) {
      return acc;
    }

    if (typeof value === 'string') {
      acc[key] = value;
      return acc;
    }

    if (typeof value === 'object') {
      try {
        acc[key] = JSON.stringify(value);
      } catch {
        acc[key] = String(value);
      }

      return acc;
    }

    acc[key] = String(value);
    return acc;
  }, {});
}

/**
 * notifyUser
 * - saves DB notification
 * - sends FCM (optional)
 * - cleans invalid FCM tokens
 */
export async function notifyUser(input: INotification) {
  
  const userId = new mongoose.Types.ObjectId(input.user);

  // Keep extra payload safe for Firebase push delivery.
  const safeData = serializeNotificationData(input.data);

  // Save in DB first so the app still has the notification record.
  const notificationDoc = await Notification.create({
    user: userId,
    title: input.title,
    body: input.body,

    type: input.type,
    entityId: input.entityId,

    webUrl: input.webUrl,
    deepLink: input.deepLink,

    isSeen: false,
    data: safeData,
  });

  const notificationId = String(notificationDoc._id);

  // Load active device tokens before attempting push.
  const user = await User.findById(userId).select('deviceTokens').lean();
  const tokens = getActiveTokens(user);

  if (!tokens.length) {
    console.warn('[notification] no active device tokens found', {
      userId: userId.toString(),
      storedDeviceTokenCount: user?.deviceTokens?.length ?? 0,
    });

    throw new AppError(StatusCodes.NOT_FOUND, 'NO_ACTIVE_TOKENS');
  }

  // Build one multicast message for all active devices.
  const message = {
    tokens,
    notification: {
      title: input.title,
      body: input.body || '',
    },
    data: {
      notificationId,
      type: input.type,
      entityId: input.entityId ? String(input.entityId) : '',
      webUrl: input.webUrl || '',
      deepLink: input.deepLink || '',
      ...safeData,
    },
  };

  // Send push notification through Firebase Admin SDK.
  let response;
  try {
    response = await admin.messaging().sendEachForMulticast(message);
  } catch (err: any) {
    // DB is saved; push failed; return gracefully
    return {
      success: true,
      notificationId,
      pushed: false,
      tokensUsed: tokens.length,
      pushError: err?.message || 'FCM_SEND_FAILED',
    };
  }

  // Remove tokens Firebase reports as invalid or expired.
  const invalidTokens: string[] = [];
  response.responses.forEach((r: admin.messaging.SendResponse, idx: number) => {
    if (r.success) return;
    const code: string = r.error?.code || '';

    if (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token'
    ) {
      invalidTokens.push(tokens[idx]);
    }
  });

  if (invalidTokens.length) {
    await cleanupInvalidTokens({ userId, invalidTokens });
  }

  return {
    success: true,
    notificationId,
    pushed: response.successCount > 0,
    tokensUsed: tokens.length,
    successCount: response.successCount,
    failureCount: response.failureCount,
    cleanedInvalidTokens: invalidTokens.length,
  };
}
