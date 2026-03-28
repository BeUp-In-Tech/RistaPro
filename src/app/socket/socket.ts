/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Server } from 'socket.io';
import { redisClient } from '../config/redis.config';
import { createAdapter } from '@socket.io/redis-adapter';

export let io: Server;

export const initSocket = async (server: any) => {
  // MULITPLE INSTANCE HANDLING
  const pubClient = redisClient.duplicate();
  const subClient = redisClient.duplicate();

  await Promise.all([pubClient.connect(), subClient.connect()]);
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling']
  });


  // REDIS ADAPTER
  io.adapter(createAdapter(pubClient, subClient));

  // This ensures that if the server crashed, we don't show ghost users
  await redisClient.del("online_users_set");



  // SOCKET CONNECTION
  io.on('connection', (socket) => {
    let currentUserId: string | null = null;

    socket.on('join-user', async (userId: string) => {
      currentUserId = userId;
      socket.join(userId);
      console.log("User joined in room: ", userId);
      

      // 1. Add user to Redis Set (Unique list)
      await redisClient.sAdd("online_users_set", userId);

      // 2. Get the updated list
      const onlineUserIds = await redisClient.sMembers("online_users_set");

      // 3. Broadcast to everyone
      io.emit('online_users', onlineUserIds);
    });


    // HANDLE DISCONNECT
    socket.on('disconnect', async () => {
      if (currentUserId) {
        // Check if this user has any other active connections in the cluster
        const matchingSockets = await io.in(currentUserId).fetchSockets();

        // Only remove from Redis if THIS was their last active connection
        if (matchingSockets.length === 0) {
          await redisClient.sRem("online_users_set", currentUserId);
          
          const onlineUserIds = await redisClient.sMembers("online_users_set");
          io.emit('online_users', onlineUserIds);

          console.log("User totally offline: ", currentUserId);
        } else {
          console.log(`User ${currentUserId} disconnected one device, but still active elsewhere.`);
        }
      }
    });
  });
};