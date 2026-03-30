import { Schema, model } from 'mongoose';
import { IMessage } from './message.interface';

const messageSchema = new Schema<IMessage>(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true },
    message: { type: String, required: true },
    seen: { type: Boolean, default: false },
    replyTo: { type: Schema.Types.ObjectId, ref: 'message' },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

const Message = model<IMessage>('message', messageSchema);

export default Message;
