import z from 'zod';
import { ConversationSource, ConversationStatus } from './conversation.interface';
import { ConversationGuardianRequestStatus } from './conversationGuardianRequest.interface';

const objectIdString = (field: string) =>
  z.string({ error: `${field} is required` }).trim().min(1, `${field} is required`);

export const conversationMessagesQueryZodSchema = z
  .object({
    candidateId: objectIdString('Candidate id'),
    before: z
      .string({ error: 'Before must be a date string' })
      .trim()
      .min(1, 'Before cannot be empty')
      .optional(),
    limit: z.coerce
      .number({ error: 'Limit must be number type' })
      .int('Limit must be an integer')
      .min(1, 'Limit must be at least 1')
      .max(100, 'Limit must be at most 100')
      .default(50),
  })
  .strict();

export const markConversationReadZodSchema = z
  .object({
    candidateId: objectIdString('Candidate id'),
  })
  .strict();

export const createGuardianRequestZodSchema = z
  .object({
    candidateId: objectIdString('Candidate id'),
    linkedUserId: objectIdString('Linked user id'),
    message: z
      .string({ error: 'Message must be string type' })
      .trim()
      .max(500, 'Message must be at most 500 characters')
      .optional(),
  })
  .strict();

export const guardianRequestListQueryZodSchema = z
  .object({
    candidateId: objectIdString('Candidate id'),
    status: z.nativeEnum(ConversationGuardianRequestStatus).optional(),
    type: z.enum(['incoming', 'outgoing', 'all']).default('incoming'),
  })
  .strict();

export const respondGuardianRequestZodSchema = z
  .object({
    candidateId: objectIdString('Candidate id'),
  })
  .strict();
