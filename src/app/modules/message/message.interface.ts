import { Document, Types } from 'mongoose';

export enum ChatMessageType {
  TEXT = 'text',
  IMAGE = 'image',
  IMAGE_TEXT = 'image_text',
  SYSTEM = 'system',
}

export { ChatMessageType as MessageType };

export interface IEncryptedMessageBody {
  ciphertext: string;
  nonce: string;
  authTag: string;
  algorithm: string;
  keyVersion: number;
}

export interface IChatAttachment {
  provider: 'cloudinary';
  cloudinaryPublicId: string;
  imageUrl: string;
  mimeType: string;
  size: number;
  width?: number | null;
  height?: number | null;
}

export interface IMessage extends Document {
  conversation: Types.ObjectId;
  sender: Types.ObjectId;
  sentBy: Types.ObjectId;
  sentByLinkedUser?: Types.ObjectId;
  senderDeviceId?: string;
  type: ChatMessageType;
  body?: IEncryptedMessageBody | null;
  attachments: IChatAttachment[];
  encryptionVersion: number;
  seenBy: Types.ObjectId[];
  replyTo?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  isDeleted: boolean;
  deletedAt?: Date | null;
  createdAt?: Date;
}

export interface ISendMessagePayload {
  conversationId: string;
  candidateId: string;
  type: ChatMessageType.TEXT | ChatMessageType.IMAGE | ChatMessageType.IMAGE_TEXT;
  message?: string;
  caption?: string;
  attachments?: IChatAttachment[];
  replyTo?: string;
}
