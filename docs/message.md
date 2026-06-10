# Message Module API

Base path: `/api/v1/messages`

This module handles sending chat messages and uploading chat images into open conversations. Text and captions are encrypted by the backend before saving to MongoDB. This is **not** E2EE — clients send plaintext, the backend encrypts at rest, and authorized API/socket responses return decrypted text.

---

## Security Rules

- All endpoints require `Authorization: Bearer <accessToken>`.
- The sender must be an active linked user of the provided `candidateId`.
- `OWNER` and `EDITOR` can send messages and upload media.
- `VIEWER` cannot send messages or upload media.
- Family, relative, guardian, and consultant linked users can send only after the opponent has accepted their guardian include request for that conversation, unless they are the primary manager.
- The candidate's plan must have `canMessage: true` (free plan cannot send messages).
- Text/captions are encrypted at rest with AES-256-GCM.
- Images are stored as normal Cloudinary assets (not encrypted).

---

## Supported Message Types

| Type         | Field used for text | Attachments required |
|--------------|---------------------|----------------------|
| `text`       | `message`           | No                   |
| `image`      | —                   | Yes                  |
| `image_text` | `caption`           | Yes                  |

---

## Image Upload Flow

Sending an image is a **2-step process**:

```
Step 1: Upload the image file
        POST /api/v1/messages/:conversationId/media
        → Returns attachment object (imageUrl, publicId, size, etc.)

Step 2: Send the message referencing the attachment
        POST /api/v1/messages
        → type: "image" or "image_text"
        → attachments: [ <attachment from step 1> ]
```

Upload the image in the background while the user types a caption. When they tap Send, the upload is already complete and the message sends instantly.

---

## `POST /:conversationId/media`

Uploads a chat image to Cloudinary and returns the attachment object to use in `POST /`.

Auth: `USER`

Content-Type: `multipart/form-data`

| Field      | Type             | Required | Description                                         |
|------------|------------------|----------|-----------------------------------------------------|
| `file`     | File             | Yes      | Image file, max 15 MB                               |
| `metadata` | Text (JSON string) | Yes    | JSON with `candidateId`, optional `width`/`height`  |

**metadata fields:**

```json
{
  "candidateId": "665f1a2b3c4d5e6f78901234",
  "width": 1080,
  "height": 1350
}
```

`width` and `height` are the real pixel dimensions of the selected image — used by the UI for placeholder sizing before the image loads.

**Getting dimensions:**

```js
// React Native (ImagePicker)
const { width, height } = result.assets[0];

// React Native (from URI)
Image.getSize(uri, (width, height) => { /* use these */ });
```

**Response:**

```json
{
  "provider": "cloudinary",
  "cloudinaryPublicId": "RistaPro/chat/conversationId/abc123",
  "imageUrl": "https://res.cloudinary.com/demo/image/upload/v1/RistaPro/chat/...",
  "mimeType": "image/jpeg",
  "size": 350000,
  "width": 1080,
  "height": 1350
}
```

Save the entire response object — pass it as an element of `attachments` in `POST /`.

---

## `POST /`

Saves one message into an open conversation. Encrypts text/caption before writing to MongoDB. Updates `lastMessage` and unread counts. Emits `message:new` via Socket.IO and queues push notifications.

Auth: `USER`

Content-Type: `application/json`

---

### Send a text message

```json
{
  "conversationId": "665f1a2b3c4d5e6f78908888",
  "candidateId": "665f1a2b3c4d5e6f78901234",
  "type": "text",
  "message": "Assalamu Alaikum"
}
```

Optional:
- `replyTo`: ID of a message in the same conversation to reply to

Rules:
- `message` is required
- `attachments` must be empty or omitted
- `caption` must be omitted

---

### Send an image (no caption)

Upload image first via `POST /:conversationId/media`, then:

```json
{
  "conversationId": "665f1a2b3c4d5e6f78908888",
  "candidateId": "665f1a2b3c4d5e6f78901234",
  "type": "image",
  "attachments": [
    {
      "provider": "cloudinary",
      "cloudinaryPublicId": "RistaPro/chat/665f1a2b3c4d5e6f78908888/abc123",
      "imageUrl": "https://res.cloudinary.com/demo/image/upload/v1/RistaPro/chat/...",
      "mimeType": "image/jpeg",
      "size": 350000,
      "width": 1080,
      "height": 1350
    }
  ]
}
```

Rules:
- At least one attachment required
- `message` and `caption` must be omitted

---

### Send an image with caption

```json
{
  "conversationId": "665f1a2b3c4d5e6f78908888",
  "candidateId": "665f1a2b3c4d5e6f78901234",
  "type": "image_text",
  "caption": "Look at this!",
  "attachments": [
    {
      "provider": "cloudinary",
      "cloudinaryPublicId": "RistaPro/chat/665f1a2b3c4d5e6f78908888/abc123",
      "imageUrl": "https://res.cloudinary.com/demo/image/upload/v1/RistaPro/chat/...",
      "mimeType": "image/jpeg",
      "size": 350000,
      "width": 1080,
      "height": 1350
    }
  ]
}
```

Rules:
- `caption` is required and will be encrypted
- At least one attachment required
- `message` must be omitted

---

## Attachment Object Schema

| Field                | Type             | Required | Description                          |
|----------------------|------------------|----------|--------------------------------------|
| `provider`           | `"cloudinary"`   | Yes      | Always `"cloudinary"`                |
| `cloudinaryPublicId` | string           | Yes      | Returned from the media upload step  |
| `imageUrl`           | string           | Yes      | Cloudinary secure URL                |
| `mimeType`           | string           | Yes      | e.g. `"image/jpeg"`, `"image/png"`   |
| `size`               | number           | Yes      | File size in bytes                   |
| `width`              | number or null   | No       | Pixel width of the image             |
| `height`             | number or null   | No       | Pixel height of the image            |

Max 10 attachments per message.

---

## Message Response Shape

All message responses from both `POST /` and `GET /conversations/:id/messages` have the same shape. The raw encrypted `body` field is never returned — it is replaced by `message` or `caption` after decryption.

```json
{
  "_id": "messageId",
  "conversation": "conversationId",
  "sender": "senderCandidateId",
  "sentBy": "senderUserId",
  "sentByLinkedUser": "linkedUserIdOrNull",
  "type": "text",
  "message": "Assalamu Alaikum",
  "attachments": [],
  "seenBy": ["senderUserId"],
  "replyTo": null,
  "isDeleted": false,
  "createdAt": "2026-06-10T10:00:00.000Z"
}
```

| Field              | Notes                                                                 |
|--------------------|-----------------------------------------------------------------------|
| `message`          | Present only for `type: "text"` — decrypted plaintext                 |
| `caption`          | Present only for `type: "image_text"` — decrypted plaintext           |
| `attachments`      | Present for `image` and `image_text` types                            |
| `messageUnavailable` | `true` if decryption failed (should not happen in normal operation) |
| `replyTo`          | Message ID being replied to, or `null`                                |

---

## Initial Message (from Message Request)

When a message request is accepted and the requester included an `initialMessage`, it is inserted as the **first Message document** in the new conversation using the exact same model structure as a regular `POST /` text message.

It loads normally via `GET /api/v1/conversations/:conversationId/messages` — no special handling needed on the frontend. The `message:new` socket event also fires when the request is accepted so both sides receive it in real time.

---

## Socket Event: `message:new`

Emitted to all conversation audience users after any message is saved (including initial messages from accepted requests).

```json
{
  "conversationId": "665f1a2b3c4d5e6f78908888",
  "message": {
    "_id": "messageId",
    "conversation": "665f1a2b3c4d5e6f78908888",
    "sender": "senderCandidateId",
    "sentBy": "senderUserId",
    "sentByLinkedUser": "linkedUserId",
    "type": "image_text",
    "caption": "Look at this!",
    "attachments": [
      {
        "provider": "cloudinary",
        "cloudinaryPublicId": "RistaPro/chat/...",
        "imageUrl": "https://res.cloudinary.com/...",
        "mimeType": "image/jpeg",
        "size": 350000,
        "width": 1080,
        "height": 1350
      }
    ],
    "seenBy": ["senderUserId"],
    "replyTo": null,
    "createdAt": "2026-06-10T10:00:00.000Z"
  }
}
```

- `text` → `message` field is decrypted plaintext
- `image_text` → `caption` field is decrypted plaintext
- `image` → neither `message` nor `caption` is present
