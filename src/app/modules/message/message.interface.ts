import { Document, Types } from 'mongoose';

export interface IMessage extends Document {
  conversation: Types.ObjectId;
  sender: Types.ObjectId;
  message: string;
  seen: boolean;
  replyTo?: Types.ObjectId;
  createdAt?: Date;
}
