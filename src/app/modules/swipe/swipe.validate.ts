import z from 'zod';
import { LikeSource, LikeType } from '../like/like.interface';

const MAX_FEED_LIMIT = 50;
const DEFAULT_FEED_LIMIT = 20;

export const swipeFeedQueryZodSchema = z
  .object({
    candidateId: z
      .string({ error: 'Candidate id is required' })
      .trim()
      .min(1, 'Candidate id is required'),
    cursor: z
      .string({ error: 'Cursor must be string type!' })
      .trim()
      .min(1, 'Cursor cannot be empty')
      .optional(),
    limit: z.coerce
      .number({ error: 'Limit must be number type!' })
      .int('Limit must be an integer')
      .min(1, 'Limit must be at least 1')
      .max(MAX_FEED_LIMIT, `Limit must be at most ${MAX_FEED_LIMIT}`)
      .default(DEFAULT_FEED_LIMIT),
  })
  .strict();

export const swipeActionZodSchema = z
  .object({
    candidateId: z
      .string({ error: 'Candidate id is required' })
      .trim()
      .min(1, 'Candidate id is required'),
    source: z
      .nativeEnum(LikeSource, { error: 'Invalid swipe source' })
      .default(LikeSource.FEED),
    targetCandidateId: z
      .string({ error: 'Target candidate id is required' })
      .trim()
      .min(1, 'Target candidate id is required'),
    type: z.nativeEnum(LikeType, {
      error: 'Swipe action type must be LIKE, SUPER_LIKE, or PASS',
    }),
  })
  .strict();
