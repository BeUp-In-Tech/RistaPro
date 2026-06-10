import z from 'zod';
import { ConversationMessageRequestStatus } from './conversationMessageRequest.interface';

const objectIdString = (field: string) =>
  z.string({ error: `${field} is required` }).trim().min(1, `${field} is required`);

export const createConversationMessageRequestZodSchema = z
  .object({
    requesterCandidateId: objectIdString('Requester candidate id'),
    targetCandidateId: objectIdString('Target candidate id'),
    initialMessage: z
      .string({ error: 'Initial message must be a string' })
      .trim()
      .min(1, 'Initial message cannot be empty')
      .max(1000, 'Initial message must be at most 1000 characters')
      .optional(),
  })
  .strict();

export const conversationMessageRequestListQueryZodSchema = z
  .object({
    candidateId: objectIdString('Candidate id'),
    status: z.nativeEnum(ConversationMessageRequestStatus).optional(),
    type: z.enum(['incoming', 'outgoing', 'all']).default('incoming'),
  })
  .strict();

export const respondConversationMessageRequestZodSchema = z
  .object({
    candidateId: objectIdString('Candidate id'),
  })
  .strict();
