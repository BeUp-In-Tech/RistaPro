import z from 'zod';
import { ChatMessageType } from './message.interface';

const requiredString = (field: string) =>
  z.string({ error: `${field} is required` }).trim().min(1, `${field} is required`);

const chatAttachmentZodSchema = z
  .object({
    provider: z.literal('cloudinary').default('cloudinary'),
    cloudinaryPublicId: requiredString('Cloudinary public id'),
    imageUrl: requiredString('Image URL'),
    mimeType: requiredString('Mime type'),
    size: z.coerce
      .number({ error: 'Size must be number type' })
      .int('Size must be an integer')
      .min(1, 'Size must be at least 1'),
    width: z.coerce
      .number({ error: 'Width must be number type' })
      .int('Width must be an integer')
      .min(1, 'Width must be at least 1')
      .nullable()
      .optional(),
    height: z.coerce
      .number({ error: 'Height must be number type' })
      .int('Height must be an integer')
      .min(1, 'Height must be at least 1')
      .nullable()
      .optional(),
  })
  .strict();

export const sendMessageZodSchema = z
  .object({
    conversationId: requiredString('Conversation id'),
    candidateId: requiredString('Candidate id'),
    type: z.enum([
      ChatMessageType.TEXT,
      ChatMessageType.IMAGE,
      ChatMessageType.IMAGE_TEXT,
    ]),
    message: z
      .string({ error: 'Message must be string type' })
      .trim()
      .min(1, 'Message cannot be empty')
      .max(5000, 'Message must be at most 5000 characters')
      .optional(),
    caption: z
      .string({ error: 'Caption must be string type' })
      .trim()
      .min(1, 'Caption cannot be empty')
      .max(5000, 'Caption must be at most 5000 characters')
      .optional(),
    attachments: z.array(chatAttachmentZodSchema).max(10).default([]),
    replyTo: z
      .string({ error: 'Reply message id must be string type' })
      .trim()
      .min(1, 'Reply message id cannot be empty')
      .optional(),
  })
  .strict()
  .superRefine((payload, context) => {
    if (payload.type === ChatMessageType.TEXT) {
      if (!payload.message) {
        context.addIssue({
          code: 'custom',
          path: ['message'],
          message: 'Message is required for text messages',
        });
      }

      if (payload.caption) {
        context.addIssue({
          code: 'custom',
          path: ['caption'],
          message: 'Text messages cannot include caption',
        });
      }

      if (payload.attachments.length > 0) {
        context.addIssue({
          code: 'custom',
          path: ['attachments'],
          message: 'Text messages cannot include attachments',
        });
      }
    }

    if (payload.type === ChatMessageType.IMAGE) {
      if (payload.message || payload.caption) {
        context.addIssue({
          code: 'custom',
          path: ['message'],
          message: 'Image-only messages cannot include text',
        });
      }

      if (payload.attachments.length === 0) {
        context.addIssue({
          code: 'custom',
          path: ['attachments'],
          message: 'Image messages require at least one attachment',
        });
      }
    }

    if (payload.type === ChatMessageType.IMAGE_TEXT) {
      if (!payload.caption) {
        context.addIssue({
          code: 'custom',
          path: ['caption'],
          message: 'Caption is required for image text messages',
        });
      }

      if (payload.message) {
        context.addIssue({
          code: 'custom',
          path: ['message'],
          message: 'Use caption for image text messages',
        });
      }

      if (payload.attachments.length === 0) {
        context.addIssue({
          code: 'custom',
          path: ['attachments'],
          message: 'Image text messages require at least one attachment',
        });
      }
    }
  });
