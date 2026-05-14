# Message Module API

Base path: `/api/v1/messages`

This module stores and sends chat messages. Conversation listing, request flows, history, and read receipts live in the conversation module.

## Security Rules

- All endpoints require `Authorization: Bearer <accessToken>`.
- The sender must be an active linked user of `candidateId`.
- `OWNER` and `EDITOR` can send.
- `VIEWER` cannot send.
- Family, relative, guardian, and consultant linked users can send only after the opponent accepts their include request for the conversation, unless that linked user is the candidate's primary manager. `OTHER` linked users cannot be included.
- The candidate owner's plan must have `canMessage: true`.

## Socket Behavior

After a message is saved, the backend emits:

```txt
message:new
```

Payload:

```json
{
  "conversationId": "conversation id",
  "message": {
    "_id": "message id",
    "conversation": "conversation id",
    "sender": "candidate id",
    "sentBy": "user id",
    "sentByLinkedUser": "linked user id",
    "message": "Hello",
    "type": "TEXT",
    "seenBy": ["sender user id"],
    "replyTo": "optional message id",
    "metadata": {},
    "createdAt": "2026-05-12T00:00:00.000Z"
  }
}
```

## `POST /`

Purpose:

- Send one text message into an open conversation.
- Update `conversation.lastMessage`.
- Increment unread counts for the other conversation audience users.
- Emit `message:new`.

Body:

```json
{
  "conversationId": "665f1a2b3c4d5e6f78908888",
  "candidateId": "665f1a2b3c4d5e6f78901234",
  "message": "Assalamu alaikum",
  "replyTo": "665f1a2b3c4d5e6f78907777"
}
```

Fields:

- `conversationId`: required open conversation id
- `candidateId`: required candidate profile id for the sender side
- `message`: required text, max 5000 characters
- `replyTo`: optional message id from the same conversation

Example:

```http
POST /api/v1/messages
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Response data:

```json
{
  "_id": "message id",
  "conversation": "conversation id",
  "sender": "candidate id",
  "sentBy": "user id",
  "sentByLinkedUser": "linked user id",
  "message": "Assalamu alaikum",
  "type": "TEXT",
  "seenBy": ["user id"],
  "createdAt": "2026-05-12T00:00:00.000Z"
}
```

## Future Call Compatibility

The message model already supports `type: "CALL"` and a flexible `metadata` object. Audio/video calling can later add call summary messages without changing the core conversation contract.
