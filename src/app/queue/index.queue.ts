import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const connection = new IORedis({
  host: '127.0.0.1',
  port: 6379,
  maxRetriesPerRequest: null,
});


// QUEE LIST
export const mailQueue = new Queue('emailSendQueue', { connection });
export const notificationQueue = new Queue('notificationQueue', { connection });
export const imageDeleteQueue = new Queue('imageDelete', { connection });
