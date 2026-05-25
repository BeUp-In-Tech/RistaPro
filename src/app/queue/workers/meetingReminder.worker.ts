/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
import { Worker } from 'bullmq';
import { MeetingScheduleService } from '../../modules/meeting_schedule/meetingSchedule.service';
import { connection } from '../index.queue';

export const meetingReminderWorker = async () => {
  const worker = new Worker(
    'meetingReminderQueue',
    async (job) => {
      try {
        await MeetingScheduleService.sendOneHourMeetingReminder(job.data.meetingId);
        console.log('Meeting reminder processed');
      } catch (error: any) {
        console.log('Meeting reminder error from BullMQ: ', error.message);
        throw error;
      }
    },
    { connection, concurrency: 20 }
  );

  worker.on('completed', (job) => {
    console.log('Meeting reminder job completed:', job.id);
  });

  worker.on('failed', (job, err) => {
    console.error(`Meeting reminder job ${job?.id ?? 'unknown'} failed:`, err);
  });
};
