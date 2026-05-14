import z from 'zod';
import { ConversationMessageRequestStatus } from './conversationMessageRequest.interface';

const objectIdString = (field: string) =>
  z.string({ error: `${field} is required` }).trim().min(1, `${field} is required`);

export const createConversationMessageRequestZodSchema = z
  .object({
    requesterCandidateId: objectIdString('Requester candidate id'),
    targetCandidateId: objectIdString('Target candidate id'),
    firstMessage: z
      .string({ error: 'First message is required' })
      .trim()
      .min(1, 'First message cannot be empty')
      .max(5000, 'First message must be at most 5000 characters'),
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
