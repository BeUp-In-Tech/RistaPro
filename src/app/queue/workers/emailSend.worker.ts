/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
import { Worker } from 'bullmq';
import { sendEmail } from '../../utils/sendMail';
import { connection } from '../index.queue';

export const emailSendWorker = async () => {
  const worker = new Worker(
    'emailSendQueue',
    async (job) => {
      try {
        await sendEmail(job.data);
        console.log('Email sent');
      } catch (error: any) {
        console.log('Email sending error from bullmq: ', error.message);
      }
    },
    { connection, concurrency: 100 } // SEND 100 EMAIL CONCURRENTLY
  );

  // LISTEN COMPLETED AND FAILED EVENT
  worker.on('completed', (job) => {
    console.log('Job completed:', job.id);
  });

  worker.on('failed', (job, err) => {
    console.error('Job failed:', err);
  });
};
