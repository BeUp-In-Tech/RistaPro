import { Schema, model } from 'mongoose';
import {
  ConversationSource,
  ConversationStatus,
  IConversation,
} from './conversation.interface';

const conversationSchema = new Schema<IConversation>(
  {
    match: { type: Schema.Types.ObjectId, ref: 'match' },
    messageRequest: {
      type: Schema.Types.ObjectId,
      ref: 'conversationMessageRequest',
    },
    pairKey: { type: String, required: true, trim: true },
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: 'candidate', required: true }],
      validate: [
        (arr: unknown[]) => Array.isArray(arr) && arr.length === 2,
        'Exactly two conversation participants required',
      ],
    },
    source: {
      type: String,
      enum: Object.values(ConversationSource),
      default: ConversationSource.MATCH,
    },
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
    },
  },
  { timestamps: true, versionKey: false }
);

conversationSchema.index({ match: 1 }, { unique: true, sparse: true });
conversationSchema.index({ messageRequest: 1 }, { unique: true, sparse: true });
conversationSchema.index(
  { pairKey: 1 },
  {
    unique: true,
    partialFilterExpression: { pairKey: { $type: 'string' } },
  }
);
conversationSchema.index({ participants: 1, status: 1, updatedAt: -1 });

const Conversation = model<IConversation>('conversation', conversationSchema);

export default Conversation;
