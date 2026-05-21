import { Types } from 'mongoose';
import z from 'zod';
import { CallType } from './call.interface';

const objectIdSchema = (fieldLabel: string) =>
  z
    .string({ error: `${fieldLabel} is required` })
    .trim()
    .min(1, `${fieldLabel} is required`)
    .refine((value) => Types.ObjectId.isValid(value), {
      message: `Invalid ${fieldLabel.toLowerCase()}`,
    });

export const startCallZodSchema = z
  .object({
    candidateId: objectIdSchema('Candidate id'),
    conversationId: objectIdSchema('Conversation id'),
    type: z.nativeEnum(CallType, { error: 'Call type must be AUDIO or VIDEO' }),
  })
  .strict();

export const callCandidateZodSchema = z
  .object({
    candidateId: objectIdSchema('Candidate id'),
  })
  .strict();

export const inviteCallParticipantZodSchema = z
  .object({
    candidateId: objectIdSchema('Candidate id'),
    linkedUserId: objectIdSchema('Linked user id'),
  })
  .strict();

export const respondCallParticipantZodSchema = z
  .object({
    action: z.enum(['ACCEPT', 'REJECT'], {
      error: 'Action must be ACCEPT or REJECT',
    }),
    candidateId: objectIdSchema('Candidate id'),
    linkedUserId: objectIdSchema('Linked user id'),
  })
  .strict();
