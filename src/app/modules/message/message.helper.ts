import { Types } from "mongoose";
import { sendNotificationByBullMQ } from "../../utils/backgroundJobProcessingHelper";
import { NotificationType } from "../notification/notification.interface";
import { ChatMessageType, TMessageForClient, TPopulatedCandidate, TPopulatedSentByUser } from "./message.interface";
import { decryptChatText } from "../../utils/chatEncryption";

export const buildSeenByResponse = (seenBy: unknown, viewerUserId?: string) => {
  if (!Array.isArray(seenBy)) {
    return seenBy;
  }

  return seenBy.reduce<unknown[]>((users, user) => {
    if (!user || typeof user !== 'object' || !('_id' in user)) {
      if (user?.toString() !== viewerUserId) {
        users.push(user);
      }

      return users;
    }

    const populatedUser = user as {
      _id?: Types.ObjectId | string;
      full_name?: string;
      name?: string;
    };

    if (populatedUser._id?.toString() === viewerUserId) {
      return users;
    }

    users.push({
      _id: populatedUser._id,
      name: populatedUser.full_name ?? populatedUser.name,
    });

    return users;
  }, []);
};

const buildSentByResponse = (sentBy: unknown) => {
  if (!sentBy || typeof sentBy !== 'object' || !('_id' in sentBy)) {
    return sentBy;
  }

  const populatedUser = sentBy as TPopulatedSentByUser;

  return {
    _id: populatedUser._id,
    image: populatedUser.image ?? populatedUser.picture ?? null,
    name: populatedUser.name ?? populatedUser.full_name,
    ...(populatedUser.role && { role: populatedUser.role }),
  };
};

export const buildMessageResponse = <T extends TMessageForClient>(message: T) => {
  const { body, seenBy, sentBy, viewerUserId, ...rest } = message;
  const response: Record<string, unknown> = { ...rest };

  if (seenBy !== undefined) {
    response.seenBy = buildSeenByResponse(seenBy, viewerUserId);
  }

  if (sentBy !== undefined) {
    response.sentBy = buildSentByResponse(sentBy);
  }

  if (
    (message.type === ChatMessageType.TEXT ||
      message.type === ChatMessageType.IMAGE_TEXT) &&
    body
  ) {
    try {
      const plaintext = decryptChatText(
        body as Parameters<typeof decryptChatText>[0]
      );

      if (message.type === ChatMessageType.TEXT) {
        response.message = plaintext;
      } else {
        response.caption = plaintext;
      }
    } catch {
      response.messageUnavailable = true;
    }
  }

  return response;
};

const getObjectIdString = ( value: Types.ObjectId | { _id?: Types.ObjectId | string } | unknown ) =>
  value && typeof value === 'object' && '_id' in value
    ? value._id?.toString()
    : value?.toString();

export const buildMessageClientResponse = <T extends TMessageForClient & { sender?: Types.ObjectId | TPopulatedCandidate}>(
  message: T,
  viewerUserId: string,
  senderSelfUserId?: string
) => {
  const senderCandidate =
    message.sender && typeof message.sender === 'object' && 'name' in message.sender
      ? (message.sender as TPopulatedCandidate)
      : undefined;
  const senderCandidateId = getObjectIdString(message.sender);
  const sentByUserId = getObjectIdString(message.sentBy);
  const messageWithSenderId = {
    ...message,
    sender: senderCandidateId ? new Types.ObjectId(senderCandidateId) : message.sender,
    viewerUserId,
  };

  if (
    senderCandidate &&
    sentByUserId &&
    senderSelfUserId === sentByUserId
  ) {
    return buildMessageResponse({
      ...messageWithSenderId,
      sentBy: {
        _id: senderCandidate._id,
        image: senderCandidate.images?.[0] ?? null,
        name: senderCandidate.name,
      },
    });
  }

  return buildMessageResponse(messageWithSenderId);
};

export const queueGenericChatNotifications = async (params: {
  senderUserId: string;
  audienceUserIds: string[];
  conversationId: string;
  messageId: string;
  type: ChatMessageType;
}) => {
  const recipients = params.audienceUserIds.filter(
    (audienceUserId) => audienceUserId !== params.senderUserId
  );

  const body =
    params.type === ChatMessageType.IMAGE ||
    params.type === ChatMessageType.IMAGE_TEXT
      ? 'You received a photo'
      : 'New message';

  await Promise.all(
    recipients.map((recipientUserId) =>
      sendNotificationByBullMQ(
        {
          user: recipientUserId,
          type: NotificationType.MESSAGE,
          title: 'New message',
          body,
          entityId: new Types.ObjectId(params.messageId),
          data: {
            conversationId: params.conversationId,
            messageId: params.messageId,
            messageType: params.type,
          },
        },
        `chat_message_${params.messageId}_${recipientUserId}`
      )
    )
  );
};