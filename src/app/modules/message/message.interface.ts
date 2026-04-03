import { Document, Types } from 'mongoose';

export interface IMessage extends Document {
  conversation: Types.ObjectId;
  sender: Types.ObjectId;
  message: string;
  seenBy: Types.ObjectId[];  
  replyTo?: Types.ObjectId;
  createdAt?: Date;
}
