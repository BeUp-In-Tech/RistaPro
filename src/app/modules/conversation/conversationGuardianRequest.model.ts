import { Schema, model } from 'mongoose';
import {
  ConversationGuardianRequestStatus,
  IConversationGuardianRequest,
} from './conversationGuardianRequest.interface';

const conversationGuardianRequestSchema =
  new Schema<IConversationGuardianRequest>(
    {
      conversation: {
        type: Schema.Types.ObjectId,
        ref: 'conversation',
        required: true,
      },
      match: { type: Schema.Types.ObjectId, ref: 'match' },
      pairKey: { type: String, required: true, trim: true },
      requesterCandidate: {
        type: Schema.Types.ObjectId,
        ref: 'candidate',
        required: true,
      },
      requesterUser: { type: Schema.Types.ObjectId, ref: 'user', required: true },
      requestedGuardianLinkedUser: {
        type: Schema.Types.ObjectId,
        ref: 'candidate_linked_user',
        required: true,
      },
      requestedGuardianUser: {
        type: Schema.Types.ObjectId,
        ref: 'user',
        required: true,
      },
      targetCandidate: {
        type: Schema.Types.ObjectId,
        ref: 'candidate',
        required: true,
      },
      targetRespondedBy: { type: Schema.Types.ObjectId, ref: 'user' },
      status: {
        type: String,
        enum: Object.values(ConversationGuardianRequestStatus),
        default: ConversationGuardianRequestStatus.PENDING,
      },
      message: { type: String, trim: true },
      respondedAt: { type: Date },
      expiresAt: { type: Date },
    },
    { timestamps: true, versionKey: false }
  );

conversationGuardianRequestSchema.index(
  {
    conversation: 1,
    requestedGuardianLinkedUser: 1,
    status: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      status: ConversationGuardianRequestStatus.PENDING,
    },
  }
);
conversationGuardianRequestSchema.index({
  conversation: 1,
  requesterCandidate: 1,
  targetCandidate: 1,
  status: 1,
});
conversationGuardianRequestSchema.index({
  targetCandidate: 1,
  status: 1,
  createdAt: -1,
});
conversationGuardianRequestSchema.index({
  requesterCandidate: 1,
  status: 1,
  createdAt: -1,
});

const ConversationGuardianRequest = model<IConversationGuardianRequest>(
  'conversationGuardianRequest',
  conversationGuardianRequestSchema
);

export default ConversationGuardianRequest;
