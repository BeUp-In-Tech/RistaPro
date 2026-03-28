/* eslint-disable @typescript-eslint/no-dynamic-delete */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Server } from 'socket.io';

export let io: Server;
export const onlineUsers: Record<string, string> = {}; // userId -> socketId

// Socket - Init
export const initSocket = (server: any) => {
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
 
    let userId: string | null = null;
    

    // Event: join-user
    socket.on('join-user', (_userId: string) => {
      userId = _userId;
      socket.join(userId);
      onlineUsers[userId] = socket.id;
      io.emit('get_online_users', Object.keys(onlineUsers));
    });

    // Handle Disconnect
    socket.on('disconnect', () => {
      if (userId) delete onlineUsers[userId];
      io.emit('get_online_users', Object.keys(onlineUsers));
    });
  });
};
