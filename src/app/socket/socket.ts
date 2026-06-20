/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { JwtPayload } from 'jsonwebtoken';
import env from '../config/env';
import { redisClient } from '../config/redis.config';
import { ActiveStatus } from '../modules/user/user.interface';
import User from '../modules/user/user.model';
import { verifyToken } from '../utils/jwt';
import { getConversationRoom, getSocketToken, userCanAccessConversation } from './socket.helper';

export let io: Server;



export const initSocket = async (server: any) => {
  const pubClient = redisClient.duplicate();
  const subClient = redisClient.duplicate();

  await Promise.all([pubClient.connect(), subClient.connect()]);
  io = new Server(server, {
    cors: {
      origin: env.FRONTEND_URL?.split(',') || ['http://localhost:3000'],
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.adapter(createAdapter(pubClient, subClient));
  await redisClient.del('online_users_set');

  io.use(async (socket, next) => {
    try {
      const token = getSocketToken(socket);
      if (!token) {
        return next(new Error('Socket token not provided'));
      }

      const verifiedUser = verifyToken(
        token,
        env.JWT_ACCESS_SECRET
      ) as JwtPayload;

      const user = await User.findById(verifiedUser.userId)
        .select('_id isActive isDeleted')
        .lean();

      if (
        !user ||
        user.isDeleted ||
        user.isActive === ActiveStatus.INACTIVE ||
        user.isActive === ActiveStatus.BLOCKED
      ) {
        return next(new Error('Socket user is not active'));
      }

      socket.data.userId = String(verifiedUser.userId);
      return next();
    } catch {
      return next(new Error('Socket authentication failed'));
    }
  });


  // SOCKET CONNECTION
  io.on('connection', (socket) => {
    const currentUserId = String(socket.data.userId);
    console.log('User connected: ', socket.id);
    socket.join(currentUserId);

    // ONLINE USER UPDATE
    void (async () => {
      await redisClient.sAdd('online_users_set', currentUserId);
      const onlineUserIds = await redisClient.sMembers('online_users_set');
      io.emit('online_users', onlineUserIds);
    })().catch((error: any) => {
      console.log('Online user sync error', error.message);
    });


    // JOIN USER IN ROOM
    socket.on('join-user', async (userId: string) => {
      if (userId !== currentUserId) {
        socket.emit('socket:error', {
          message: 'Cannot join another user room',
        });
        return;
      }

      socket.join(currentUserId);
      console.log("User joined: ", currentUserId);
      
      await redisClient.sAdd('online_users_set', currentUserId);

      const onlineUserIds = await redisClient.sMembers('online_users_set');
      io.emit('online_users', onlineUserIds);
    });

    // JOIN USER IN CONVERSATION ROOM
    socket.on('join-conversation', async (conversationId: string) => {
      try {
        const canAccess = await userCanAccessConversation(
          currentUserId,
          conversationId
        );

        if (!canAccess) {
          socket.emit('conversation:error', {
            conversationId,
            message: 'You are not a member of this conversation',
          });
          return;
        }

        socket.join(getConversationRoom(conversationId));
        console.log("User joined in conversation: ", conversationId);
      } catch {
        socket.emit('conversation:error', {
          conversationId,
          message: 'Conversation access check failed',
        });
      }
    });

    socket.on('leave-conversation', (conversationId: string) => {
      socket.leave(getConversationRoom(conversationId));
    });


    // Socket typing indicator start
    socket.on('typing:start', async (payload: { conversationId: string }) => {
      try {
        const canAccess = await userCanAccessConversation(
          currentUserId,
          payload.conversationId
        );

        if (!canAccess) {
          return;
        }

        socket.to(getConversationRoom(payload.conversationId)).emit(
          'typing:start',
          {
            conversationId: payload.conversationId,
            userId: currentUserId,
          }
        );
      } catch {
        return;
      }
    });

    // socket typing indicator stop
    socket.on('typing:stop', async (payload: { conversationId: string }) => {
      try {
        const canAccess = await userCanAccessConversation(
          currentUserId,
          payload.conversationId
        );

        if (!canAccess) {
          return;
        }

        socket.to(getConversationRoom(payload.conversationId)).emit(
          'typing:stop',
          {
            conversationId: payload.conversationId,
            userId: currentUserId,
          }
        );
      } catch {
        return;
      }
    });


    // Handle socket disconnect
    socket.on('disconnect', async () => {
      try {
        const matchingSockets = await io.in(currentUserId).fetchSockets();

        if (matchingSockets.length === 0) {
          await redisClient.sRem('online_users_set', currentUserId);

          const onlineUserIds = await redisClient.sMembers('online_users_set');
          io.emit('online_users', onlineUserIds);

          console.log('User totally offline: ', currentUserId);
          console.log('User disconnected: ', socket.id);
        } else {
          console.log(
            `User ${currentUserId} disconnected one device, but still active elsewhere.`
          );
        }
      } catch (error: any) {
        console.log('Disconnect error', error.message);
      }
    });
  });
};
