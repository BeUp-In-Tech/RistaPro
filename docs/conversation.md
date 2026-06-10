# Conversation Module API

Base path: `/api/v1/conversations`

This module manages chat threads, message requests (with optional initial message), normal chat media upload, guardian/parent include requests, history, and read receipts. Chat text/captions are backend-encrypted at rest, then decrypted for authorized API/socket responses. This is not E2EE.

## Security Rules

- All endpoints require `Authorization: Bearer <accessToken>`.
- The requester must be an active linked user of the provided `candidateId`.
- `OWNER` and `EDITOR` can start/respond/send request actions.
- `VIEWER` can read allowed conversations but cannot send messages or upload chat media.
- Family, relative, guardian, and consultant linked users can read/send only after the opponent accepts an include request for that exact linked user, unless that linked user is the candidate's primary manager.
- Free plan users cannot create message requests, send chat messages, or upload chat media because `canMessage` is false.
- Images are normal readable Cloudinary assets in this simplified phase.

---

## Socket.IO

Clients must connect with the access token in `auth.token` or the `Authorization: Bearer <accessToken>` socket header.

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

`message:new` payload contains decrypted `message` or `caption` for authorized users.

---

## Match Conversation

### `POST /matches/:matchId/start`

Returns or creates the open conversation for an active match.

Query:

```txt
candidateId=<candidateId>   optional but recommended
```

---

## Conversation List

### `GET /`

Query:

```txt
candidateId=<candidateId>        required
status=OPEN|ARCHIVED|BLOCKED     optional, default OPEN
```

Response includes populated `opponent` and decrypted `lastMessage`:

```json
{
  "meta": { "page": 1, "limit": 20, "total": 5, "totalPage": 1 },
  "conversations": [
    {
      "_id": "conversationId",
      "status": "OPEN",
      "lastMessage": {
        "_id": "messageId",
        "type": "text",
        "message": "Assalamu Alaikum"
      },
      "opponent": {
        "_id": "candidateId",
        "name": "Ahmed",
        "image": "https://res.cloudinary.com/..."
      },
      "unreadCount": 2
    }
  ]
}
```

---

## Message History

### `GET /:conversationId/messages`

Returns messages sorted oldest to newest. Text/captions are decrypted by the backend.

Query:

```txt
candidateId=<candidateId>   required
limit=<1-100>               optional, default 50
before=<ISO date>           optional — cursor for pagination (load older messages)
```

Response:

```json
{
  "opponent": { "_id": "...", "name": "...", "image": "..." },
  "messages": [ ...message objects ]
}
```

For pagination, pass the `createdAt` of the oldest loaded message as `before` to fetch the previous page.

---

## Read Receipt

### `PATCH /:conversationId/read`

Marks all messages in the conversation as seen by the current user. Resets unread count to 0.

Body:

```json
{
  "candidateId": "candidateId"
}
```

**When to call:** immediately after opening a conversation, and whenever a `message:new` event arrives while that conversation is visible.

Emits socket event `conversation:read` to all participants:

```json
{
  "conversationId": "...",
  "candidateId": "...",
  "seenBy": "userId"
}
```

---

## Chat Media Upload

### `POST /:conversationId/media`

Uploads a chat image to Cloudinary. Returns an attachment object to include in a `/api/v1/messages` POST call.

Content-Type: `multipart/form-data`

Fields:

```txt
file=<image file>
metadata={"candidateId":"...","width":1080,"height":1350}
```

Response:

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

---

## Message Request Flow

A message request allows a candidate to initiate a chat with another candidate before any conversation exists. An optional `initialMessage` can be sent with the request — it is encrypted and stored. When the target accepts, the message is inserted as the first real message in the conversation.

### `POST /message_requests`

Body:

```json
{
  "requesterCandidateId": "candidateA",
  "targetCandidateId": "candidateB",
  "initialMessage": "Assalamu Alaikum, I saw your profile..."
}
```

- `initialMessage` is optional, max 1000 characters.
- The backend encrypts `initialMessage` at rest. It is **not** visible to the target until they accept.
- Emits `message-request:new` socket event.
- A second pending request in the same direction is rejected.
- Previously rejected requests can be re-sent.

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

- Accepts the request and creates/opens the conversation.
- If an `initialMessage` was included in the request, it is inserted as the **first Message document** in the conversation using the same model as `/api/v1/messages`.
- Unread counts and `lastMessage` are updated immediately.
- Emits `message-request:accepted`, `conversation:started`, and (if initial message present) `message:new` socket events.

Response includes `initialMessage` field (decrypted) when one was provided:

```json
{
  "request": { ... },
  "conversation": { ... },
  "initialMessage": {
    "_id": "messageId",
    "type": "text",
    "message": "Assalamu Alaikum, I saw your profile...",
    "sender": "candidateAId",
    "sentBy": "userAId",
    "seenBy": ["userAId"],
    "createdAt": "2026-06-10T10:00:00.000Z"
  }
}
```

### `PATCH /message-requests/:requestId/reject`

Body:

```json
{
  "candidateId": "targetCandidateId"
}
```

---

## Relative/Guardian Include Flow

### `POST /:conversationId/guardian-requests`

Requests the opponent to include a family/guardian linked user in the conversation.

Body:

```json
{
  "candidateId": "candidateA",
  "linkedUserId": "relativeLinkedUserId",
  "message": "Optional request note (max 500 chars)"
}
```

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

---

## Conversation Status Values

| Status     | Description              |
|------------|--------------------------|
| `OPEN`     | Active conversation      |
| `ARCHIVED` | Closed conversation      |
| `BLOCKED`  | Blocked conversation     |

## Message Request Status Values

| Status      | Description                              |
|-------------|------------------------------------------|
| `PENDING`   | Awaiting target response                 |
| `ACCEPTED`  | Target accepted — conversation is open   |
| `REJECTED`  | Target rejected the request              |
| `CANCELLED` | Requester cancelled the request          |
