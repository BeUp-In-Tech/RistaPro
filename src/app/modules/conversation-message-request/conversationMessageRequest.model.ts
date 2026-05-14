import { Schema, model } from 'mongoose';
import {
  ConversationMessageRequestStatus,
  IConversationMessageRequest,
} from './conversationMessageRequest.interface';

const conversationMessageRequestSchema =
  new Schema<IConversationMessageRequest>(
    {
      pairKey: { type: String, required: true, trim: true },
      requesterCandidate: {
        type: Schema.Types.ObjectId,
        ref: 'candidate',
        required: true,
      },
      requesterUser: { type: Schema.Types.ObjectId, ref: 'user', required: true },
      targetCandidate: {
        type: Schema.Types.ObjectId,
        ref: 'candidate',
        required: true,
      },
      targetRespondedBy: { type: Schema.Types.ObjectId, ref: 'user' },
      firstMessage: { type: String, required: true, trim: true },
      conversation: { type: Schema.Types.ObjectId, ref: 'conversation' },
      status: {
        type: String,
        enum: Object.values(ConversationMessageRequestStatus),
        default: ConversationMessageRequestStatus.PENDING,
      },
      respondedAt: { type: Date },
      expiresAt: { type: Date },
    },
    { timestamps: true, versionKey: false }
  );

conversationMessageRequestSchema.index(
  { requesterCandidate: 1, targetCandidate: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: ConversationMessageRequestStatus.PENDING,
    },
  }
);
conversationMessageRequestSchema.index({
  targetCandidate: 1,
  status: 1,
  createdAt: -1,
});
conversationMessageRequestSchema.index({
  requesterCandidate: 1,
  status: 1,
  createdAt: -1,
});
conversationMessageRequestSchema.index({ pairKey: 1, status: 1, createdAt: -1 });

const ConversationMessageRequest = model<IConversationMessageRequest>(
  'conversationMessageRequest',
  conversationMessageRequestSchema
);

export default ConversationMessageRequest;
