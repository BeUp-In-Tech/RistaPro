import z from 'zod';
import { LikeSource, LikeType } from '../like/like.interface';
import { Types } from 'mongoose';

const MAX_FEED_LIMIT = 50;
const DEFAULT_FEED_LIMIT = 20;
const DEFAULT_PAGE = 1;

const objectIdSchema = (fieldLabel: string) =>
  z
    .string({ error: `${fieldLabel} is required` })
    .trim()
    .min(1, `${fieldLabel} is required`)
    .refine((value) => Types.ObjectId.isValid(value), {
      message: `Invalid ${fieldLabel.toLowerCase()}`,
    });

export const swipeFeedQueryZodSchema = z
  .object({
    candidateId: objectIdSchema('Candidate id'),
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

export const nearbyMatchesQueryZodSchema = z
  .object({
    limit: z.coerce
      .number({ error: 'Limit must be number type!' })
      .int('Limit must be an integer')
      .min(1, 'Limit must be at least 1')
      .max(MAX_FEED_LIMIT, `Limit must be at most ${MAX_FEED_LIMIT}`)
      .default(DEFAULT_FEED_LIMIT),
    page: z.coerce
      .number({ error: 'Page must be number type!' })
      .int('Page must be an integer')
      .min(1, 'Page must be at least 1')
      .default(DEFAULT_PAGE),
    radiusKm: z.coerce
      .number({ error: 'Radius must be number type!' })
      .min(1, 'Radius must be at least 1 km')
      .max(10000, 'Radius must be at most 10000 km')
      .optional(),
  })
  .strict();

export const swipeActionZodSchema = z
  .object({
    candidateId: objectIdSchema('Candidate id'),
    source: z
      .nativeEnum(LikeSource, { error: 'Invalid swipe source' })
      .default(LikeSource.FEED),
    targetCandidateId: objectIdSchema('Target candidate id'),
    type: z.nativeEnum(LikeType, {
      error: 'Swipe action type must be LIKE, SUPER_LIKE, or PASS',
    }),
  })
  .strict();
