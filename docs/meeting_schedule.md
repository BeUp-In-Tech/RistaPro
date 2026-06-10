# Meeting Schedule Module API

Base path: `/api/v1/meeting-schedules`

This module manages formal video/audio meeting requests between candidates and consultants. Requesting a meeting automatically creates or reuses a linked consultation case in the background.

## Security Rules

- All endpoints require `Authorization: Bearer <accessToken>`.
- Guest join endpoint is handled via the consultant module: `POST /api/v1/consultant/guest-invites/:token/meetings/:meetingId/join`.
- Consultant features (`canUseConsultant`) require the **Platinum plan**.
- `VIEWER` linked users cannot create or join meetings.
- Join window opens **10 minutes before** scheduled time and closes **1 hour after** (meeting duration).

---

## Meeting Status Values

| Status                  | Description                                          |
|-------------------------|------------------------------------------------------|
| `PENDING`               | Requested by candidate, awaiting consultant action   |
| `CONFIRMED`             | Consultant set a scheduled time                      |
| `RESCHEDULE_REQUESTED`  | Either party proposed a new time                     |
| `COMPLETED`             | Meeting finished                                     |
| `CANCELLED`             | Meeting was cancelled                                |
| `REJECTED`              | Consultant rejected the request                      |

---

## Request a Meeting

### `POST /`

Candidate requests a formal meeting with a consultant.

Role: `USER`

Body:

```json
{
  "candidateId": "candidateId",
  "consultantId": "consultantUserId",
  "type": "VIDEO",
  "requestedTimeSlots": [
    "2025-06-15T10:00:00.000Z",
    "2025-06-16T14:00:00.000Z"
  ],
  "note": "Optional note for the consultant"
}
```

- `type`: `VIDEO` or `AUDIO`
- `requestedTimeSlots`: up to 5 future datetime slots. Optional but recommended so the consultant can pick one.
- Creates or reuses a consultation case in the background. Returns `caseId` alongside the meeting.

Response includes `caseId` field linking to the consultation case.

---

## List Meetings

### `GET /`

Returns meetings for the authenticated user sorted by scheduled time.

Role: `USER`, `CONSULTANT`

Query:

```txt
candidateId=<candidateId>                                 required for USER role
status=PENDING|CONFIRMED|RESCHEDULE_REQUESTED|...         optional
```

---

## Get a Single Meeting

### `GET /:meetingId`

Role: `USER`, `CONSULTANT`

---

## Confirm a Meeting

### `PATCH /:meetingId/confirm`

Consultant sets the final scheduled time and confirms the meeting.

Role: `CONSULTANT`

Body:

```json
{
  "schedule_time": "2025-06-15T10:00:00.000Z",
  "consultantNote": "Optional note for the candidate"
}
```

- `schedule_time` must be in the future.
- Resets join window and clears any previous Agora channel.
- Sends a push notification to the candidate's linked users.
- Schedules a 1-hour reminder notification + email automatically.

---

## Reschedule a Meeting

### `PATCH /:meetingId/reschedule`

Either party can propose new time slots or the consultant can directly set a new confirmed time.

Role: `USER`, `CONSULTANT`

Body:

```json
{
  "requestedTimeSlots": ["2025-06-20T10:00:00.000Z"],
  "schedule_time": "2025-06-20T10:00:00.000Z",
  "note": "Optional note",
  "consultantNote": "Optional consultant note"
}
```

- At least one field is required.
- If `CONSULTANT` provides `schedule_time`, the meeting is immediately re-confirmed (`CONFIRMED`).
- If `USER` sends time slots without a confirmed time, status becomes `RESCHEDULE_REQUESTED`.
- Cannot reschedule `CANCELLED`, `COMPLETED`, or `REJECTED` meetings.

---

## Join a Meeting

### `POST /:meetingId/join`

Returns Agora RTC credentials to join the video/audio call.

Role: `USER`, `CONSULTANT`

Body:

```json
{
  "candidateId": "candidateId"
}
```

- `candidateId` is optional for `USER` — required only if the user is linked to multiple candidates in the case.
- Can only be called within the join window (10 min before → 1 hour after scheduled time).

Response:

```json
{
  "agora": {
    "appId": "agoraAppId",
    "channelName": "meeting_<meetingId>",
    "uid": 123456789,
    "token": "agoraRtcToken",
    "expiresAt": "2025-06-15T11:00:00.000Z"
  },
  "meeting": {
    "_id": "meetingId",
    "status": "CONFIRMED",
    "schedule_time": "2025-06-15T10:00:00.000Z",
    "joinWindowStartsAt": "2025-06-15T09:50:00.000Z",
    "joinWindowEndsAt": "2025-06-15T11:00:00.000Z",
    "canJoin": true,
    "participants": [...],
    ...
  }
}
```

- Calling join again with the same user reuses the existing `agoraUid` — idempotent.
- Guest join is handled via: `POST /api/v1/consultant/guest-invites/:token/meetings/:meetingId/join`

---

## Meeting Response Fields

| Field                | Description                                              |
|----------------------|----------------------------------------------------------|
| `_id`                | Meeting ID                                               |
| `status`             | Current meeting status                                   |
| `type`               | `VIDEO` or `AUDIO`                                       |
| `candidate`          | Requesting candidate ID                                  |
| `consultant`         | Consultant user ID                                       |
| `case`               | Linked consultation case ID                              |
| `requestedTimeSlots` | Proposed time slots from the candidate                   |
| `schedule_time`      | Final confirmed meeting time                             |
| `joinWindowStartsAt` | When participants can start joining (10 min before)      |
| `joinWindowEndsAt`   | When the join window closes (1 hour after)               |
| `canJoin`            | `true` if currently within join window                   |
| `agoraChannelName`   | RTC channel name (set on first join)                     |
| `participants`       | Array of users who have joined with their Agora UIDs     |
| `note`               | Candidate's note                                         |
| `consultantNote`     | Consultant's note                                        |
| `rescheduleCount`    | How many times the meeting was rescheduled               |
| `requestedBy`        | User ID who created the meeting request                  |
