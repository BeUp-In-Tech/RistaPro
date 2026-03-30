import { Document, Types } from 'mongoose';

export interface IMatch extends Document {
  candidates: Types.ObjectId[];
}
