import { Schema, model } from 'mongoose';
import { ChatMessageType, IMessage } from './message.interface';

const encryptedBodySchema = new Schema(
  {
    ciphertext: {
      type: String,
      required: true,
    },
    nonce: {
      type: String,
      required: true,
    },
    authTag: {
      type: String,
      required: true,
    },
    algorithm: {
      type: String,
      default: 'AES-256-GCM',
    },
    keyVersion: {
      type: Number,
      required: true,
    },
  },
  { _id: false, versionKey: false }
);

const chatAttachmentSchema = new Schema(
  {
    provider: {
      type: String,
      enum: ['cloudinary'],
      default: 'cloudinary',
    },
    cloudinaryPublicId: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    width: {
      type: Number,
      default: null,
    },
    height: {
      type: Number,
      default: null,
    },
  },
  { _id: false, versionKey: false }
);

const messageSchema = new Schema<IMessage>(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: 'conversation',
      required: true,
    },
    sender: { type: Schema.Types.ObjectId, ref: 'candidate', required: true },
    sentBy: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    sentByLinkedUser: {
      type: Schema.Types.ObjectId,
      ref: 'candidate_linked_user',
    },
    senderDeviceId: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(ChatMessageType),
      required: true,
    },
    body: {
      type: encryptedBodySchema,
      default: null,
    },
    attachments: {
      type: [chatAttachmentSchema],
      default: [],
    },
    encryptionVersion: {
      type: Number,
      default: 1,
    },
    seenBy: { type: [Schema.Types.ObjectId], ref: 'user', default: [] },
    replyTo: { type: Schema.Types.ObjectId, ref: 'message' },
    metadata: { type: Schema.Types.Mixed },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ sentBy: 1, createdAt: -1 });
messageSchema.index({ 'attachments.cloudinaryPublicId': 1 });

const Message = model<IMessage>('message', messageSchema);

export default Message;
