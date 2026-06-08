# Conversation Module API

Base path: `/api/v1/conversations`

This module manages chat threads, message requests, normal chat media upload, guardian/parent include requests, history, and read receipts. Chat text/captions are backend-encrypted at rest, then decrypted for authorized API/socket responses. This is not E2EE.

## Security Rules

- All endpoints require `Authorization: Bearer <accessToken>`.
- The requester must be an active linked user of the provided `candidateId`.
- `OWNER` and `EDITOR` can start/respond/send request actions.
- `VIEWER` can read allowed conversations but cannot send messages or upload chat media.
- Family, relative, guardian, and consultant linked users can read/send only after the opponent accepts an include request for that exact linked user, unless that linked user is the candidate's primary manager.
- Free plan users cannot create message requests, send chat messages, or upload chat media because `canMessage` is false.
- Images are normal readable Cloudinary assets in this simplified phase.

## Socket.IO

Clients must connect with the access token in `auth.token` or the `Authorization: Bearer <accessToken>` socket header. The server verifies the token and automatically joins the authenticated user room.

Client events:

```txt
join-user             userId
join-conversation     conversationId
leave-conversation    conversationId
typing:start          { conversationId, candidateId }
typing:stop           { conversationId, candidateId }
```

Server events:

```txt
online_users
conversation:started
message-request:new
message-request:accepted
message-request:rejected
message:new
conversation:read
guardian-request:new
guardian-request:accepted
guardian-request:rejected
guardian:included
typing:start
typing:stop
conversation:error
socket:error
```

`message:new` contains decrypted `message` or `caption` for authorized users.

## Match Conversation

### `POST /matches/:matchId/start`

Returns or creates the open conversation for an active match.

Query:

```txt
candidateId=<candidateId>   optional but recommended
```

## Conversation List

### `GET /`

Query:

```txt
candidateId=<candidateId>        required
status=OPEN|ARCHIVED|BLOCKED     optional, default OPEN
```

Conversation `lastMessage`, if present, returns decrypted text/caption:

```json
{
  "_id": "conversation id",
  "lastMessage": {
    "_id": "message id",
    "type": "image_text",
    "caption": "Family photo",
    "attachments": []
  }
}
```

## Message History

### `GET /:conversationId/messages`

Query:

```txt
candidateId=<candidateId>   required
limit=<1-100>               optional, default 50
before=<ISO date>           optional
```

Returns messages sorted oldest to newest for the selected page. Text/captions are decrypted by the backend only after authorization succeeds.

## Chat Media Upload

### `POST /:conversationId/media`

Uploads a normal readable chat image to Cloudinary.

Content type: `multipart/form-data`

Fields:

```txt
file=<image file>
metadata={"candidateId":"...","width":1080,"height":1350}
```

Response data:

```json
{
  "provider": "cloudinary",
  "cloudinaryPublicId": "chat/media/conversationId/asset",
  "imageUrl": "https://res.cloudinary.com/...",
  "mimeType": "image/jpeg",
  "size": 350000,
  "width": 1080,
  "height": 1350
}
```

Include this response in `attachments` when creating `image` or `image_text` messages with `/api/v1/messages`.

## Read Receipt

### `PATCH /:conversationId/read`

Body:

```json
{
  "candidateId": "candidateId"
}
```

## Message Request Flow

### `POST /message_requests`

Body:

```json
{
  "requesterCandidateId": "candidateA",
  "targetCandidateId": "candidateB"
}
```

Behavior:

- saves a pending request
- emits `message-request:new`
- rejected requests can be sent again later
- a second pending request for the same direction is rejected

### `GET /message_requests`

Query:

```txt
candidateId=<candidateId>                  required
type=incoming|outgoing|all                 optional, default incoming
status=PENDING|ACCEPTED|REJECTED|CANCELLED optional
```

### `PATCH /message-requests/:requestId/accept`

Body:

```json
{
  "candidateId": "targetCandidateId"
}
```

Behavior:

- accepts the request
- creates or opens the conversation
- emits `message-request:accepted` and `conversation:started`

### `PATCH /message-requests/:requestId/reject`

Body:

```json
{
  "candidateId": "targetCandidateId"
}
```

## Relative Include Flow

### `POST /:conversationId/guardian-requests`

Body:

```json
{
  "candidateId": "candidateA",
  "linkedUserId": "relativeLinkedUserId",
  "message": "Optional request note"
}
```

Guardian request notes are request metadata, not encrypted chat messages.

### `GET /guardian-requests`

Query:

```txt
candidateId=<candidateId>                  required
type=incoming|outgoing|all                 optional, default incoming
status=PENDING|ACCEPTED|REJECTED|CANCELLED optional
```

### `PATCH /guardian-requests/:requestId/accept`

Body:

```json
{
  "candidateId": "opponentCandidateId"
}
```

### `PATCH /guardian-requests/:requestId/reject`

Body:

```json
{
  "candidateId": "opponentCandidateId"
}
```
