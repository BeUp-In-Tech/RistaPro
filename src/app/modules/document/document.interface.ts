import { Document, Types } from 'mongoose';

export enum DocumentType {
  ID = 'ID',
  EDUCATION = 'EDUCATION',
  PARENT = 'PARENT',
  PARENT_PHOTO = 'PARENT_PHOTO',
  PARENT_ID = 'PARENT_ID',
  FACE = 'FACE',
}

export enum DocumentVerification {
  NONE = 'NONE',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface IDocumentFile {
  file: string;
  title?: string;
}

export interface IDocument extends Document {
  candidate: Types.ObjectId;
  type: DocumentType;
  document: string;
  documents?: IDocumentFile[];
  verification_status: DocumentVerification;
  rejected_reason?: string;
}
