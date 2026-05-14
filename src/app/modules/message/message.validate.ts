import z from 'zod';

export const sendMessageZodSchema = z
  .object({
    conversationId: z
      .string({ error: 'Conversation id is required' })
      .trim()
      .min(1, 'Conversation id is required'),
    candidateId: z
      .string({ error: 'Candidate id is required' })
      .trim()
      .min(1, 'Candidate id is required'),
    message: z
      .string({ error: 'Message is required' })
      .trim()
      .min(1, 'Message cannot be empty')
      .max(5000, 'Message must be at most 5000 characters'),
    replyTo: z
      .string({ error: 'Reply message id must be string type' })
      .trim()
      .min(1, 'Reply message id cannot be empty')
      .optional(),
  })
  .strict();
