import { Schema, model } from 'mongoose';
import { IVisitor } from './visitor.interface';

const visitorSchema = new Schema<IVisitor>(
  {
    visitedBy: { type: Schema.Types.ObjectId, ref: 'candidate', required: true },
    vistedProfile: { type: Schema.Types.ObjectId, ref: 'candidate', required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

const Visitor = model<IVisitor>('visitor', visitorSchema);

export default Visitor;
