# Message Module API

Base path: `/api/v1/messages`

This module handles sending chat messages and uploading chat images. Text and captions are encrypted by the backend before saving to MongoDB. This is not E2EE — clients send plaintext, the backend encrypts at rest, and authorized API/socket responses return decrypted text.

---

## Security Rules

- All endpoints require `Authorization: Bearer <accessToken>`.
- The sender must be an active linked user of `candidateId`.
- `OWNER` and `EDITOR` can send messages and upload media.
- `VIEWER` cannot send messages or upload media.
- Family, relative, guardian, and consultant linked users can send only after the opponent accepts their include request for the conversation, unless that linked user is the candidate's primary manager.
- The candidate owner's plan must have `canMessage: true`.
- Text/captions are encrypted in MongoDB with AES-256-GCM.
- Images are stored as normal Cloudinary assets (not encrypted).

---

## Supported Message Types

| Type | Description |
|------|-------------|
| `text` | Plain text message only — no attachments |
| `image` | One or more images — no text or caption |
| `image_text` | One or more images plus a text caption |

---

## Image Upload Flow

Sending an image is a **2-step process**:

```
Step 1: Upload the image file
        POST /api/v1/messages/conversations/:conversationId/media
        → Returns attachment object with imageUrl, publicId, size, etc.

Step 2: Send the message with the attachment object
        POST /api/v1/messages
        → type: "image" or "image_text"
        → attachments: [ ...attachment from step 1 ]
```

This design means the image uploads in the background while the user types a caption. When they tap Send, the upload is already done and the message sends instantly.

---

## `POST /conversations/:conversationId/media`

Purpose:

- Upload a chat image to Cloudinary.
- Returns the attachment object to include in the subsequent `POST /` message call.

Auth: Bearer token, `USER`

Content-Type: `multipart/form-data`

### How to send in Postman

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | The image file to upload (max 15MB) |
| `metadata` | Text (JSON string) | Yes | JSON string with `candidateId`, optional `width` and `height` |

**Postman form-data fields:**

```
file      → [select image file from disk]
metadata  → {"candidateId":"665f1a2b3c4d5e6f78901234","width":1080,"height":1350}
```

> Important: `metadata` must be sent as a **plain text field** containing a JSON string, not as a file.

### metadata fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `candidateId` | string | Yes | The sender's candidate ID |
| `width` | number | No | Actual pixel width of the image (for UI placeholder sizing) |
| `height` | number | No | Actual pixel height of the image (for UI placeholder sizing) |

### Where to get width and height

These are the real pixel dimensions of the image the user selected — not a random value.

**React Native (from ImagePicker):**
```js
const result = await ImagePicker.launchImageLibraryAsync();
const { width, height } = result.assets[0]; // already available
```

**React Native (from URI):**
```js
Image.getSize(uri, (width, height) => { /* use these */ });
```

**Flutter:**
```dart
final decoded = await decodeImageFromList(imageBytes);
final width = decoded.width;
final height = decoded.height;
```

### Response

```json
{
  "provider": "cloudinary",
  "cloudinaryPublicId": "RistaPro/chat/665f1a2b3c4d5e6f78908888/abc123",
  "imageUrl": "https://res.cloudinary.com/demo/image/upload/v1/RistaPro/chat/...",
  "mimeType": "image/jpeg",
  "size": 350000,
  "width": 1080,
  "height": 1350
}
```

Save the entire response object — you will pass it as an element of `attachments` in `POST /`.

---

## `POST /`

Purpose:

- Save one text, image, or image+caption message into an open conversation.
- Encrypts text/caption before saving to MongoDB.
- Updates `conversation.lastMessage` and unread counts.
- Emits `message:new` via Socket.IO.
- Queues generic FCM push notifications.

Auth: Bearer token, `USER`

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

Optional field:
- `replyTo`: ID of the message being replied to (must exist in the same conversation)

Rules:
- `message` is required
- `attachments` must be empty or omitted
- `caption` must be omitted

---

### Send an image (no caption)

First upload the image with `POST /conversations/:conversationId/media`, then:

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
- `attachments` must have at least one item
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
- `caption` is required (this gets encrypted by the backend)
- `attachments` must have at least one item
- `message` must be omitted

---

## Attachment Object Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider` | `"cloudinary"` | Yes | Always `"cloudinary"` |
| `cloudinaryPublicId` | string | Yes | The Cloudinary public ID returned from the upload step |
| `imageUrl` | string | Yes | The Cloudinary secure URL |
| `mimeType` | string | Yes | e.g. `"image/jpeg"`, `"image/png"` |
| `size` | number | Yes | File size in bytes |
| `width` | number or null | No | Pixel width of the image |
| `height` | number or null | No | Pixel height of the image |

Max 10 attachments per message.

---

## Socket Event: `message:new`

Emitted to all conversation audience users after a message is saved.

```json
{
  "conversationId": "665f1a2b3c4d5e6f78908888",
  "message": {
    "_id": "message id",
    "conversation": "665f1a2b3c4d5e6f78908888",
    "sender": "sender candidate id",
    "sentBy": "sender user id",
    "sentByLinkedUser": "linked user id",
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
    "seenBy": ["sender user id"],
    "replyTo": null,
    "createdAt": "2026-05-12T10:00:00.000Z"
  }
}
```

For `text` messages, `message` field contains decrypted plaintext.
For `image_text` messages, `caption` field contains decrypted plaintext.
For `image` messages, neither `message` nor `caption` is present.
