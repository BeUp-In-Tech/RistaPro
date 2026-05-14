import { Schema, model } from 'mongoose';
import { IMessage, MessageType } from './message.interface';

const messageSchema = new Schema<IMessage>(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'conversation', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'candidate', required: true },
    sentBy: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    sentByLinkedUser: { type: Schema.Types.ObjectId, ref: 'candidate_linked_user' },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: Object.values(MessageType),
      default: MessageType.TEXT,
    },
    seenBy: { type: [Schema.Types.ObjectId], ref: 'user', default: [] },
    replyTo: { type: Schema.Types.ObjectId, ref: 'message' },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ sentBy: 1, createdAt: -1 });

const Message = model<IMessage>('message', messageSchema);

export default Message;
