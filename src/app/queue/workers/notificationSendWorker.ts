/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
import { Worker } from 'bullmq';
import { connection } from '../index.queue';
import { notifyUser } from '../../modules/notification/notification.service';
import AppError from '../../errorHelpers/AppError';
import { StatusCodes } from 'http-status-codes';

export const notificationSendWorker = async () => {
  const worker = new Worker(
    'notificationQueue',
    async (job) => {
      try {
        await notifyUser(job.data);
        console.log('Notification sent');
      } catch (error: any) {
        console.log('Notification sending error from bullmq: ', error.message);
        throw new AppError(StatusCodes.BAD_REQUEST, error.message)
      }
    },
    { connection, concurrency: 100 } // SEND 100 EMAIL CONCURRENTLY
  );

  // LISTEN COMPLETED AND FAILED EVENT
  worker.on('completed', (job) => {
    console.log('Notification Job completed:', job.id);
  });

  worker.on('failed', (job, err) => {
    console.error('Notification Job failed:', err);
  });
};
