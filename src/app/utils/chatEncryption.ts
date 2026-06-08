import crypto from 'crypto';
import env from '../config/env';

const ALGORITHM = 'AES-256-GCM';
const KEY_VERSION = 1;
const NONCE_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export interface IServerEncryptedText {
  ciphertext: string;
  nonce: string;
  authTag: string;
  algorithm: typeof ALGORITHM;
  keyVersion: number;
}

const getChatEncryptionKey = () => {
  const key = Buffer.from(env.CHAT_ENCRYPTION_KEY, 'base64');

  if (key.length !== 32) {
    throw new Error(
      'CHAT_ENCRYPTION_KEY must be a base64 encoded 32-byte key'
    );
  }

  return key;
};

export const encryptChatText = (plaintext: string): IServerEncryptedText => {
  const nonce = crypto.randomBytes(NONCE_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', getChatEncryptionKey(), nonce, {
    authTagLength: AUTH_TAG_BYTES,
  });

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString('base64'),
    nonce: nonce.toString('base64'),
    authTag: authTag.toString('base64'),
    algorithm: ALGORITHM,
    keyVersion: KEY_VERSION,
  };
};

export const decryptChatText = (encrypted: IServerEncryptedText): string => {
  if (
    encrypted.algorithm !== ALGORITHM ||
    encrypted.keyVersion !== KEY_VERSION ||
    !encrypted.authTag
  ) {
    throw new Error('Unsupported chat encryption payload');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getChatEncryptionKey(),
    Buffer.from(encrypted.nonce, 'base64'),
    { authTagLength: AUTH_TAG_BYTES }
  );

  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
};
