import { mailQueue } from "../queue/index.queue";
import { SendEmailOptions } from "./sendMail";

// SEND EMAIL TO QUEU
const sendMailByBullMQ = async (emailPayload: SendEmailOptions, jobId: string) => {
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

export default sendMailByBullMQ;