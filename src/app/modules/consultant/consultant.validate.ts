import { Types } from 'mongoose';
import z from 'zod';
import {
  ConsultantAssignmentStatus,
  ConsultantMarriagePartyType,
  ConsultationCaseStatus,
} from './consultant.interface';

const objectIdSchema = (fieldLabel: string) =>
  z
    .string({ error: `${fieldLabel} is required` })
    .trim()
    .min(1, `${fieldLabel} is required`)
    .refine((value) => Types.ObjectId.isValid(value), {
      message: `Invalid ${fieldLabel.toLowerCase()}`,
    });

const optionalTextSchema = (fieldLabel: string, max = 500) =>
  z
    .string({ error: `${fieldLabel} must be string type!` })
    .trim()
    .max(max, `${fieldLabel} must be at most ${max} characters long`)
    .optional();

const paginationQuerySchema = {
  limit: z.coerce.number().int().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
};

export const availableConsultantsQueryZodSchema = z
  .object({
    candidateId: objectIdSchema('Candidate id'),
  })
  .strict();

export const startConsultationCaseZodSchema = z
  .object({
    candidateId: objectIdSchema('Candidate id'),
    consultantId: objectIdSchema('Consultant id'),
    note: optionalTextSchema('Note'),
    title: optionalTextSchema('Title', 120),
  })
  .strict();

export const createConsultationCaseZodSchema = z
  .object({
    candidateIds: z
      .array(objectIdSchema('Candidate id'))
      .min(1, 'At least one candidate is required')
      .max(2, 'A consultation case can have at most two real candidates'),
    note: optionalTextSchema('Note'),
    title: optionalTextSchema('Title', 120),
  })
  .strict();

export const consultationCaseListQueryZodSchema = z
  .object({
    candidateId: objectIdSchema('Candidate id').optional(),
    status: z.nativeEnum(ConsultationCaseStatus).optional(),
  })
  .strict();

export const addCaseCandidateZodSchema = z
  .object({
    candidateId: objectIdSchema('Candidate id'),
  })
  .strict();

export const createCandidateInviteZodSchema = z
  .object({
    candidateId: objectIdSchema('Candidate id'),
  })
  .strict();

export const sendConsultationMessageZodSchema = z
  .object({
    candidateId: objectIdSchema('Candidate id').optional(),
    message: z
      .string({ error: 'Message must be string type!' })
      .trim()
      .min(1, 'Message is required')
      .max(3000, 'Message must be at most 3000 characters long'),
  })
  .strict();

export const consultationMessagesQueryZodSchema = z
  .object(paginationQuerySchema)
  .strict();

export const createGuestInviteZodSchema = z
  .object({
    contact: optionalTextSchema('Contact', 120),
    displayName: z
      .string({ error: 'Display name must be string type!' })
      .trim()
      .min(1, 'Display name is required')
      .max(120, 'Display name must be at most 120 characters long'),
    expiresAt: z.coerce
      .date({ error: 'Expires at must be a valid date' })
      .refine((value) => value.getTime() > Date.now(), {
        message: 'Expires at must be in the future',
      })
      .optional(),
  })
  .strict();

export const createConsultantMarriageRecordZodSchema = z
  .object({
    caseId: objectIdSchema('Case id').optional(),
    marriedAt: z.coerce.date({ error: 'Married at must be a valid date' }).optional(),
    note: optionalTextSchema('Note'),
    parties: z
      .array(
        z
          .object({
            candidateId: objectIdSchema('Candidate id').optional(),
            contact: optionalTextSchema('Contact', 120),
            displayName: optionalTextSchema('Display name', 120),
            guestInviteId: objectIdSchema('Guest invite id').optional(),
            partyType: z.nativeEnum(ConsultantMarriagePartyType),
          })
          .strict()
      )
      .length(2, 'Exactly two parties are required'),
  })
  .strict();

export const consultantMarriageRecordListQueryZodSchema = z
  .object({
    caseId: objectIdSchema('Case id').optional(),
    ...paginationQuerySchema,
  })
  .strict();
