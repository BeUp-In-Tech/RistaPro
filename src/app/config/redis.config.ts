/* eslint-disable no-console */

import { createClient } from 'redis';
import env from './env';

export const redisClient = createClient({
  socket: {
    host: env.REDIS_HOST,
    port: Number(env.REDIS_PORT) || 6379,    // tls: true
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
redisClient.on('error', (error: any) => console.log('Redis client error', error));

export const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log('Redis connected');
  }
};
