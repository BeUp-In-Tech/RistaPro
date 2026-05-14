import { Schema, model } from 'mongoose';
import { IReport, ReportReason, ReportStatus } from './report.interface';

const reportSchema = new Schema<IReport>(
  {
    reportedCandidate: { type: Schema.Types.ObjectId, ref: 'candidate', required: true },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'candidate', required: true },
    reason: { type: String, enum: Object.values(ReportReason), required: true },
    description: { type: String },
    status: { type: String, enum: Object.values(ReportStatus), default: ReportStatus.PENDING },
  },
  { timestamps: true, versionKey: false }
);

const Report = model<IReport>('report', reportSchema);

export default Report;
