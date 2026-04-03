import { Document, Types } from 'mongoose';

export enum DocumentType {
  ID = 'ID',
  EDUCATION = 'EDUCATION',
  INCOME = 'INCOME',
  PHOTO = 'PHOTO',
  OTHER = 'OTHER',
}

export enum DocumentVerification {
  NONE = 'NONE',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface IDocument extends Document {
  candidate: Types.ObjectId;
  type: DocumentType;
  document: string;
  verification_status: DocumentVerification;
  rejected_reason?: string;
}
