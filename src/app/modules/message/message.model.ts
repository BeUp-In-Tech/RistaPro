import { Schema, model } from 'mongoose';
import { IMessage } from './message.interface';

const messageSchema = new Schema<IMessage>(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'conversation', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'candidate', required: true },
    message: { type: String, required: true },
    seenBy: { type: [Schema.Types.ObjectId], ref: 'user' },
    replyTo: { type: [Schema.Types.ObjectId], ref: 'message' },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

const Message = model<IMessage>('message', messageSchema);

export default Message;
