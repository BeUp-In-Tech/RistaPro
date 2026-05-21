import { Schema, model } from 'mongoose';
import { IVisitor } from './visitor.interface';

const visitorSchema = new Schema<IVisitor>(
  {
    lastVisitedAt: { type: Date, required: true, default: Date.now },
    visitCount: { type: Number, required: true, default: 0, min: 0 },
    visitedBy: { type: Schema.Types.ObjectId, ref: 'candidate', required: true },
    visitedProfile: {
      type: Schema.Types.ObjectId,
      ref: 'candidate',
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

visitorSchema.index({ visitedBy: 1, visitedProfile: 1 }, { unique: true });
visitorSchema.index({ visitedProfile: 1, lastVisitedAt: -1 });

const Visitor = model<IVisitor>('visitor', visitorSchema);

export default Visitor;
