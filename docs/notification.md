# Notification Module API

Base path: `/api/v1/notifications`

This module retrieves and manages in-app notifications for the authenticated user. Notifications are created automatically by the backend when relevant events occur (new match, new message, meeting request, etc.).

## Security Rules

- All endpoints require `Authorization: Bearer <accessToken>`.
- Users can only access their own notifications.

---

## Notification Types

| Type               | Triggered by                                             |
|--------------------|----------------------------------------------------------|
| `MATCH`            | A new match is created                                   |
| `CALL`             | An incoming call                                         |
| `MESSAGE`          | A new chat message                                       |
| `MARRIAGE_REQUEST` | A marriage request is sent or responded to               |
| `SYSTEM`           | Consultant invites, meeting confirmations, etc.          |
| `REMINDER`         | Meeting reminder (1 hour before scheduled time)          |

---

## `GET /`

Returns paginated notifications for the authenticated user, sorted newest first.

Auth: Any authenticated role

Query:

```txt
page=<number>       optional, default 1
limit=<1-100>       optional, default 20
isSeen=true|false   optional — filter by seen status
```

Response:

```json
{
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPage": 3
  },
  "notifications": [
    {
      "_id": "notificationId",
      "type": "MESSAGE",
      "title": "New message",
      "body": "You have a new message",
      "isSeen": false,
      "entityId": "relatedEntityId",
      "webUrl": "/conversations/conversationId",
      "deepLink": "ristapro://conversations/conversationId",
      "data": {
        "conversationId": "...",
        "messageId": "...",
        "messageType": "text"
      },
      "createdAt": "2026-06-10T10:00:00.000Z"
    }
  ]
}
```

---

## `PATCH /:id/seen`

Marks a single notification as seen.

Auth: Any authenticated role

No body required.

Response: the updated notification object with `isSeen: true`.

---

## Notification `data` Field by Type

The `data` field contains context-specific IDs for deep linking.

| Type               | Key fields in `data`                                      |
|--------------------|-----------------------------------------------------------|
| `MESSAGE`          | `conversationId`, `messageId`, `messageType`              |
| `MATCH`            | `matchId`                                                 |
| `MARRIAGE_REQUEST` | `requestId`, `progressId`                                 |
| `SYSTEM`           | Varies — e.g. `meetingId`, `caseId`, `inviteId`, `action` |
| `REMINDER`         | `meetingId`, `action: "CONSULTANT_MEETING_REMINDER_1H"`   |

Use `webUrl` for web routing and `deepLink` for mobile deep linking.
