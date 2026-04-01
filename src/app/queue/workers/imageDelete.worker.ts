/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
import { Worker } from 'bullmq';
import { connection } from '../index.queue';
import { asyncMultipleImageDelete } from '../../utils/cloudinaryImageDelete';

export const imageDeleteWorker = async () => {
  const worker = new Worker(
    'imageDeleteQueue',
    async (job) => {
      try {
        await asyncMultipleImageDelete(job.data as string[])
        console.log('Image deleted');
      } catch (error: any) {
        console.log('Image delete error from bullmq: ', error.message);
      }
    },
    { connection, concurrency: 100 } // SEND 100 EMAIL CONCURRENTLY
  );

  // LISTEN COMPLETED AND FAILED EVENT
  worker.on('completed', (job) => {
    console.log('Image Delete Job completed:', job.id);
  });

  worker.on('failed', (job, err) => {
    console.error('Image Delete Job completed:', err);
  });
};
