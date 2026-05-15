import { z } from 'zod';
import { DocumentType } from './document.interface';

const documentUploadTypes = [DocumentType.ID, DocumentType.EDUCATION] as const;

const parseStringifiedArray = (value: unknown) => {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return [value];
  }
};

export const faceVerificationZodSchema = z.object({
  candidateId: z.string('Candidate ID is required'),
  isFaceVerified: z.boolean({ error: 'Face verification result is required' }),
});

export const documentUploadZodSchema = z.object({
  candidateId: z.string('Candidate ID is required'),
  type: z.enum(documentUploadTypes, {
    error: 'Document type must be ID or EDUCATION',
  }),
  title: z
    .string({ error: 'Document title must be string type' })
    .trim()
    .min(1, 'Document title cannot be empty')
    .max(120, 'Document title must be at most 120 characters long')
    .optional(),
  titles: z
    .preprocess(
      parseStringifiedArray,
      z.array(
        z
          .string({ error: 'Document title must be string type' })
          .trim()
          .min(1, 'Document title cannot be empty')
          .max(120, 'Document title must be at most 120 characters long')
      )
    )
    .optional(),
});

export const parentPhotoUploadZodSchema = z.object({
  candidateId: z.string('Candidate ID is required'),
});

export const parentFaceVerificationZodSchema = z.object({
  candidateId: z.string('Candidate ID is required'),
  isFaceVerified: z.boolean({
    error: 'Parent face verification result is required',
  }),
});

export const parentIdUploadZodSchema = z.object({
  candidateId: z.string('Candidate ID is required'),
  title: z
    .string({ error: 'Document title must be string type' })
    .trim()
    .min(1, 'Document title cannot be empty')
    .max(120, 'Document title must be at most 120 characters long')
    .optional(),
  titles: z
    .preprocess(
      parseStringifiedArray,
      z.array(
        z
          .string({ error: 'Document title must be string type' })
          .trim()
          .min(1, 'Document title cannot be empty')
          .max(120, 'Document title must be at most 120 characters long')
      )
    )
    .optional(),
});

export const documentRejectZodSchema = z.object({
  rejected_reason: z
    .string({ error: 'Rejected reason is required' })
    .trim()
    .min(1, 'Rejected reason is required')
    .max(500, 'Rejected reason must be at most 500 characters long'),
});
