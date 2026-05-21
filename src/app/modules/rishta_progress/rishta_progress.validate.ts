import z from 'zod';
import { RishtaMarriageRequestStatus } from './rishta_progress.interface';

const objectIdString = (field: string) =>
  z.string({ error: `${field} is required` }).trim().min(1, `${field} is required`);

const pairLocatorSchema = z
  .object({
    candidateId: objectIdString('Candidate id').optional(),
    otherCandidateId: objectIdString('Other candidate id').optional(),
    matchId: objectIdString('Match id').optional(),
    conversationId: objectIdString('Conversation id').optional(),
    progressId: objectIdString('Progress id').optional(),
  })
  .strict()
  .refine(
    (payload) =>
      Boolean(payload.progressId) ||
      Boolean(payload.matchId) ||
      Boolean(payload.conversationId) ||
      Boolean(payload.candidateId && payload.otherCandidateId),
    {
      message:
        'Provide progressId, matchId, conversationId, or candidateId with otherCandidateId',
    }
  );

export const rishtaProgressQueryZodSchema = pairLocatorSchema.safeExtend({
  candidateId: objectIdString('Candidate id'),
});

export const createMarriageRequestZodSchema = pairLocatorSchema;

export const respondMarriageRequestZodSchema = z
  .object({
    candidateId: objectIdString('Candidate id'),
    rejectReason: z
      .string({ error: 'Reject reason must be string type' })
      .trim()
      .max(500, 'Reject reason must be at most 500 characters')
      .optional(),
  })
  .strict();

export const adminMarkMarriedZodSchema = pairLocatorSchema;

export const marriedListQueryZodSchema = z
  .object({
    page: z.coerce
      .number({ error: 'Page must be number type' })
      .int('Page must be an integer')
      .min(1, 'Page must be at least 1')
      .default(1),
    limit: z.coerce
      .number({ error: 'Limit must be number type' })
      .int('Limit must be an integer')
      .min(1, 'Limit must be at least 1')
      .max(100, 'Limit must be at most 100')
      .default(20),
  })
  .strict();

export const marriageRequestListQueryZodSchema = z
  .object({
    candidateId: objectIdString('Candidate id'),
    page: z.coerce
      .number({ error: 'Page must be number type' })
      .int('Page must be an integer')
      .min(1, 'Page must be at least 1')
      .default(1),
    limit: z.coerce
      .number({ error: 'Limit must be number type' })
      .int('Limit must be an integer')
      .min(1, 'Limit must be at least 1')
      .max(100, 'Limit must be at most 100')
      .default(20),
    sort: z
      .string({ error: 'Sort must be string type' })
      .trim()
      .min(1, 'Sort cannot be empty')
      .optional(),
    status: z
      .nativeEnum(RishtaMarriageRequestStatus, {
        error: 'Invalid marriage request status',
      })
      .optional(),
  })
  .strict();
