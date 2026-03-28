/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
import nodemailer from 'nodemailer';
import env from '../config/env';
import AppError from '../errorHelpers/AppError';
import path from 'path';
import ejs from 'ejs';

const transporter = nodemailer.createTransport({
  secure: true,
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASSWORD,
  },
  port: Number(env.EMAIL_PORT),
  host: env.EMAIL_HOST,
});

interface SendEmailOptions {
  to: string;
  subject: string;
  templateName: string;
  templateData?: Record<string, any>;
  attachements?: {
    filename: string;
    content: Buffer | string;
    contentType: string;
  }[];
}

export const sendEmail = async ({
  to,
  subject,
  templateName,
  templateData,
  attachements,
}: SendEmailOptions) => {
  try {
    const templatePath = path.join(__dirname, `templates/${templateName}.ejs`);
    const html = await ejs.renderFile(templatePath, templateData);
    await transporter.sendMail({
      from: env.EMAIL_USER,
      to: to,
      subject: subject,
      html: html,
      attachments: attachements?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
      })),
    });
  } catch (error: any) {
    console.log('Email sending error', error.message);
    throw new AppError(400, 'Email error');
  }
};
