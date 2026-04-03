import { Schema, model } from 'mongoose';
import { ConversationStatus, IConversation } from './conversation.interface';

const conversationSchema = new Schema<IConversation>(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: 'candidate', required: true }],
    status: {
      type: String,
      enum: Object.values(ConversationStatus),
      default: ConversationStatus.OPEN,
    },
    parentInvolvement: { type: Boolean, default: false },
    lastMessage: { type: Schema.Types.ObjectId, ref: 'message' },
    unreadCounts: {
      type: Map,
      of: Number,
      default: new Map(),
    },  },
  { timestamps: true, versionKey: false }
);

const Conversation = model<IConversation>('conversation', conversationSchema);

export default Conversation;
