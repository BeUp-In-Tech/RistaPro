/* eslint-disable @typescript-eslint/no-explicit-any */
import { getConversationAudienceUserIds, getConversationByIdOrThrow } from "../modules/conversation/conversation.helper";
import { io } from "./socket";

// GET CONVERSATION ROOM
export const getConversationRoom = (conversationId: string) =>
  `conversation:${conversationId}`;

// EVENT EMITTER FUNCTION
export const emitChatEvent = (params: {
  conversationId?: string;
  event: string;
  payload: unknown;
  userIds?: string[];
}) => {
  if (!io) {
    return;
  }

  const uniqueUserIds = Array.from(new Set(params.userIds ?? []));
  const target = uniqueUserIds.length
    ? io.to(uniqueUserIds)
    : params.conversationId
      ? io.to(getConversationRoom(params.conversationId))
      : io;

  target.emit(params.event, params.payload);
};


// SOCKET TOKEN GET UTILITY FUNCTION
export const getSocketToken = (socket: any) => {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim()) {
    return authToken.startsWith('Bearer ')
      ? authToken.split(' ')[1]
      : authToken.trim();
  }

  const authorizationHeader = socket.handshake.headers?.authorization;
  if (
    typeof authorizationHeader === 'string' &&
    authorizationHeader.startsWith('Bearer ')
  ) {
    return authorizationHeader.split(' ')[1];
  }

  return null;
};

// IS USER CAN ACCESS IN CONVERSATION 
export const userCanAccessConversation = async (
  userId: string,
  conversationId: string
) => {
  const conversation = await getConversationByIdOrThrow(conversationId);
  const audienceUserIds = await getConversationAudienceUserIds(conversation);

  return audienceUserIds.includes(userId);
};