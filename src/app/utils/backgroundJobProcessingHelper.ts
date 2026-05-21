import { INotificationPayload } from "../modules/notification/notification.interface";
import { imageDeleteQueue,  mailQueue,  notificationQueue } from "../queue/index.queue";
import { SendEmailOptions } from "./sendMail";

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
