import { INotification } from "../modules/notification/notification.interface";
import { mailQueue, notificationQueue } from "../queue/index.queue";
import { SendEmailOptions } from "./sendMail";

// SEND EMAIL TO QUEUe
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


// Send Notification To Queue
export const sendNotificationByBullMQ = async (notificationPayload: INotification, jobId: string) => {  
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