/* eslint-disable no-console */
import mongoose from "mongoose";
import env from "../config/env";
import { emailSendWorker } from "./workers/emailSend.worker";
import { notificationSendWorker } from "./workers/notificationSendWorkder";

// RUN ALL WORKER JOB HERE WITH DATABASE CONNECTION
const connectQueeuDB = async () => {
  try {
    await mongoose.connect(env.MONGO_URI as string);
    console.log('Connected to queue database');
     
    // EMAIL SEND WORKER
    emailSendWorker();

    // NOTIFICATION WORKER
    notificationSendWorker();
    

  } catch (error) {
    console.log('Error connecting to Redis:', error);
  }
};

connectQueeuDB();