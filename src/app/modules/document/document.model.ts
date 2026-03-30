import { Schema, model } from 'mongoose';
import { DocumentType, DocumentVerification, IDocument } from './document.interface';

const documentSchema = new Schema<IDocument>(
  {
    candidate: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true },
    type: { type: String, enum: Object.values(DocumentType), required: true },
    documents: { type: String, required: true },
    verification_status: {
      type: String,
      enum: Object.values(DocumentVerification),
      default: DocumentVerification.NONE,
    },
    rejected_reason: { type: String },
  },
  { timestamps: true, versionKey: false }
);

const DocumentModel = model<IDocument>('document', documentSchema);

export default DocumentModel;
