import { Document, Types } from 'mongoose';

export enum ReportReason {
  SPAM = 'SPAM',
  ABUSE = 'ABUSE',
  FAKE = 'FAKE',
  OTHER = 'OTHER',
}

export enum ReportStatus {
  PENDING = 'PENDING',
  REVIEWING = 'REVIEWING',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
}

export interface IReport extends Document {
  reportedCandidate: Types.ObjectId;
  reportedBy: Types.ObjectId;
  reason: ReportReason;
  description?: string;
  status: ReportStatus;
}
