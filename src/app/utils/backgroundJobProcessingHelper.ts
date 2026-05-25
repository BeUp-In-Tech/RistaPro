import { INotificationPayload } from "../modules/notification/notification.interface";
import { imageDeleteQueue,  mailQueue,  meetingReminderQueue,  notificationQueue } from "../queue/index.queue";
import { SendEmailOptions } from "./sendMail";

export const getMeetingReminderJobId = (meetingId: string) =>
  `meeting_reminder_1h:${meetingId}`;

// SEND EMAIL JOB ADD TO QUEUE
export const sendMailByBullMQ = async (emailPayload: SendEmailOptions, jobId: string) => {
    await mailQueue.add('sendEmail', emailPayload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      jobId,
      removeOnComplete: true,
    });
}


// SEND NOTIFICATION JOB ADD TO QUEUE
export const sendNotificationByBullMQ = async (notificationPayload: INotificationPayload, jobId: string) => {  
  await notificationQueue.add('sendNotification', notificationPayload, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    jobId,
    removeOnComplete: true,
  })  
}

// MEETING REMINDER JOB ADD TO QUEUE
export const scheduleMeetingReminderByBullMQ = async (meetingId: string, runAt: Date) => {
  const jobId = getMeetingReminderJobId(meetingId);
  const existingJob = await meetingReminderQueue.getJob(jobId);
  if (existingJob) {
    await existingJob.remove();
  }

  await meetingReminderQueue.add(
    'sendMeetingReminder',
    { meetingId },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      delay: Math.max(0, runAt.getTime() - Date.now()),
      jobId,
      removeOnComplete: true,
    }
  );
}

// REMOVE MEETING REMINDER JOB
export const removeMeetingReminderByBullMQ = async (meetingId: string) => {
  const existingJob = await meetingReminderQueue.getJob(
    getMeetingReminderJobId(meetingId)
  );

  if (existingJob) {
    await existingJob.remove();
  }
}

// IMAGE DELETE JOB ADD TO QUEUE
export const deleteImageByBullMQ = async (images: string[], jobId: string) => {  
  await imageDeleteQueue.add('deleteImage', images, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    jobId,
    removeOnComplete: true,
  })  
}
