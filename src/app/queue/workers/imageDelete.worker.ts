/* eslint-disable no-console */
import { Worker } from 'bullmq';
import { connection } from '../index.queue';
import { asyncMultipleImageDelete } from '../../utils/cloudinaryImageDelete';

export const imageDeleteWorker = async () => {
  const worker = new Worker(
    'imageDeleteQueue',
    async (job) => {
      await asyncMultipleImageDelete(job.data as string[]);
      console.log('Image deleted');    },
    { connection, concurrency: 100 } // SEND 100 IMAGE CONCURRENTLY
  );

  // LISTEN COMPLETED AND FAILED EVENT
  worker.on('completed', (job) => {
    console.log('Image Delete Job completed:', job.id);
  });

  worker.on('failed', (job, err) => {
    console.error('Image Delete Job failed:', job?.id, err);
  });};
