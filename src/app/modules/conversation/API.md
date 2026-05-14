# Conversation Module API

Base path: `/api/v1/conversations`

This module manages chat threads, message requests, and guardian/parent include requests. Realtime delivery uses Socket.IO events after the database write succeeds.

## Security Rules

- All endpoints require `Authorization: Bearer <accessToken>`.
- The requester must be an active linked user of the provided `candidateId`.
- `OWNER` and `EDITOR` can start/respond/send request actions.
- `VIEWER` can read allowed conversations but cannot send messages or respond to requests.
- Family, relative, guardian, and consultant linked users can read/send only after the opponent accepts an include request for that exact linked user, unless that linked user is the candidate's primary manager. `OTHER` linked users cannot be included.
- Free plan users cannot create message requests or send chat messages because `canMessage` is false.

## Socket.IO

Client connection URL is the same backend host.

Required client events:

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
```

## Match Conversation

### `POST /matches/:matchId/start`

Returns or creates the open conversation for an active match.

Query:

```txt
candidateId=<candidateId>   optional but recommended
```

Example:

```http
POST /api/v1/conversations/matches/665f1a2b3c4d5e6f78909999/start?candidateId=665f1a2b3c4d5e6f78901234
Authorization: Bearer <accessToken>
```

## Conversation List

### `GET /`

Query:

```txt
candidateId=<candidateId>        required
status=OPEN|ARCHIVED|BLOCKED     optional, default OPEN
```

Example:

```http
GET /api/v1/conversations?candidateId=665f1a2b3c4d5e6f78901234
Authorization: Bearer <accessToken>
```

## Message History

### `GET /:conversationId/messages`

Query:

```txt
candidateId=<candidateId>   required
limit=<1-100>               optional, default 50
before=<ISO date>           optional
```

Example:

```http
GET /api/v1/conversations/665f1a2b3c4d5e6f78908888/messages?candidateId=665f1a2b3c4d5e6f78901234&limit=50
Authorization: Bearer <accessToken>
```

### `PATCH /:conversationId/read`

Body:

```json
{
  "candidateId": "665f1a2b3c4d5e6f78901234"
}
```

## Message Request Flow

### `POST /message_requests`

Body:

```json
{
  "requesterCandidateId": "candidateA",
  "targetCandidateId": "candidateB",
  "firstMessage": "Assalamu alaikum, can we start a conversation?"
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
candidateId=<candidateId>                required
type=incoming|outgoing|all               optional, default incoming
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
- saves the request `firstMessage` as the first chat message
- emits `message-request:accepted`, `conversation:started`, and `message:new`

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
  "message": "I want to include my family member in this chat."
}
```

Behavior:

- the linked user must belong to `candidateId`
- relationship must be `FATHER`, `MOTHER`, `BROTHER`, `SISTER`, `GUARDIAN`, `RELATIVE`, or `CONSULTANT`
- saves a pending DB request
- emits `guardian-request:new` to the opponent side in realtime

### `GET /guardian-requests`

Query:

```txt
candidateId=<candidateId>                 required
type=incoming|outgoing|all                optional, default incoming
status=PENDING|ACCEPTED|REJECTED|CANCELLED optional
```

### `PATCH /guardian-requests/:requestId/accept`

Body:

```json
{
  "candidateId": "opponentCandidateId"
}
```

Behavior:

- marks the request as accepted
- adds that exact guardian linked user to `conversation.guardianParticipants`
- emits `guardian-request:accepted` and `guardian:included`
- the approved guardian can now list/read/send in that conversation

### `PATCH /guardian-requests/:requestId/reject`

Body:

```json
{
  "candidateId": "opponentCandidateId"
}
```

Rejected guardian requests do not include the guardian. The requester may send a new request later.

## Postman Smoke Test

Environment:

```txt
baseUrl=http://localhost:3000/api/v1
tokenA=
tokenB=
candidateA=
candidateB=
matchId=
conversationId=
messageRequestId=
guardianRequestId=
guardianLinkedUserId=
```

Steps:

1. Login users A and B, then load their candidate ids.
2. Create a mutual swipe match, or send a message request from A to B.
3. For match flow, call `POST {{baseUrl}}/conversations/matches/{{matchId}}/start?candidateId={{candidateA}}`.
4. For request flow, A calls `POST {{baseUrl}}/conversations/message-requests`; B lists incoming requests and accepts one.
5. Send a message with `POST {{baseUrl}}/messages`.
6. Load messages with `GET {{baseUrl}}/conversations/{{conversationId}}/messages?candidateId={{candidateA}}`.
7. Mark read with `PATCH {{baseUrl}}/conversations/{{conversationId}}/read`.
8. A sends `POST {{baseUrl}}/conversations/{{conversationId}}/guardian-requests`.
9. B accepts the guardian request.
10. Login as the approved guardian and use the same conversation message APIs with `candidateId={{candidateA}}`.
