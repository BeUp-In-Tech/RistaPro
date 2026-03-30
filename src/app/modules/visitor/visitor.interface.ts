import { Document, Types } from 'mongoose';

export interface IVisitor extends Document {
  visitedBy: Types.ObjectId;
  vistedProfile: Types.ObjectId;
  createdAt?: Date;
}
