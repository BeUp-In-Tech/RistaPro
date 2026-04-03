import { Document, Types } from 'mongoose';

export interface IVisitor extends Document {
  visitedBy: Types.ObjectId;
  visitedProfile: Types.ObjectId;  createdAt?: Date;
}
