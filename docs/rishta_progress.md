# Rishta Progress Module API

Base path: `/api/v1/rishta-progress`

This module tracks the relationship journey between two candidates from match to marriage. Progress advances automatically as milestones are reached (match created, chat started, parent involved). Marriage is confirmed via a two-party marriage request flow.

## Security Rules

- All endpoints require `Authorization: Bearer <accessToken>`.
- Users can only access progress records where their candidate is a participant.
- Admin and Consultant roles have elevated access to view married records and confirm marriages.

---

## Progress Steps

Steps are completed in order. Each step unlocks the next.

| Step              | Completed when                                                  |
|-------------------|-----------------------------------------------------------------|
| `MATCHES`         | A match is created between the two candidates                   |
| `START_CHAT`      | First message is sent in the conversation                       |
| `PARENT_INVOLVES` | A guardian/family linked user is included in the conversation   |
| `SHAADI`          | A marriage request is accepted by both parties                  |

`progressValue` is a 0–100 number derived from how many steps are complete.

---

## `GET /`

Returns the rishta progress record between the authenticated user's candidate and another candidate.

Auth: `USER`

Query — provide one of the following combinations:

```txt
candidateId=<id>   required in all cases

Option A: progressId=<id>
Option B: matchId=<id>
Option C: conversationId=<id>
Option D: candidateId=<id> + otherCandidateId=<id>
```

Response:

```json
{
  "_id": "progressId",
  "candidates": ["candidateAId", "candidateBId"],
  "pairKey": "...",
  "match": "matchId",
  "conversation": "conversationId",
  "completedSteps": ["MATCHES", "START_CHAT"],
  "progressValue": 50,
  "status": "ACTIVE",
  "stepDetails": [
    {
      "step": "MATCHES",
      "completedAt": "2026-05-01T10:00:00.000Z",
      "source": "MATCH_CREATED"
    },
    {
      "step": "START_CHAT",
      "completedAt": "2026-05-02T10:00:00.000Z",
      "source": "MATCH_CHAT_STARTED"
    }
  ],
  "createdAt": "2026-05-01T10:00:00.000Z",
  "updatedAt": "2026-05-02T10:00:00.000Z"
}
```

---

## Marriage Request Flow

When both families are ready to confirm the marriage, either candidate (or a consultant) submits a marriage request. Both candidates must accept for the progress to be marked `MARRIED`.

### `POST /marriage-requests`

Creates a marriage request for the pair.

Auth: `USER`, `CONSULTANT`

Body — provide one locator:

```json
{
  "progressId": "progressId"
}
```

Or use `matchId`, `conversationId`, or `candidateId + otherCandidateId` instead.

### `GET /marriage-requests`

Lists marriage requests for a candidate.

Auth: `USER`

Query:

```txt
candidateId=<id>                                 required
page=<number>                                    optional, default 1
limit=<1-100>                                    optional, default 20
status=PENDING|ACCEPTED|REJECTED|CANCELLED       optional
sort=<field>                                     optional
```

Response:

```json
{
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPage": 1 },
  "data": [
    {
      "_id": "requestId",
      "status": "PENDING",
      "requestedByRole": "USER",
      "canRespond": true,
      "currentCandidateApproved": false,
      "otherCandidate": {
        "_id": "...",
        "name": "Sara",
        "age": 24,
        "gender": "FEMALE",
        "images": ["..."],
        "livesIn": "London"
      },
      "approvals": [],
      "createdAt": "2026-06-10T10:00:00.000Z"
    }
  ]
}
```

### `PATCH /marriage-requests/:requestId/accept`

Accepts the marriage request on behalf of the candidate.

Auth: `USER`

Body:

```json
{
  "candidateId": "candidateId"
}
```

When **both** candidates accept, the progress status becomes `MARRIED` and `progressValue` reaches 100.

### `PATCH /marriage-requests/:requestId/reject`

Rejects the marriage request.

Auth: `USER`

Body:

```json
{
  "candidateId": "candidateId",
  "rejectReason": "Optional reason (max 500 chars)"
}
```

---

## Admin / Consultant Endpoints

### `POST /admin/married`

Admin manually marks a candidate pair as married (bypasses the request flow).

Auth: `ADMIN`

Body — provide one locator:

```json
{
  "matchId": "matchId"
}
```

### `GET /married`

Returns a paginated list of all married candidate pairs.

Auth: `ADMIN`, `CONSULTANT`

Query:

```txt
page=<number>    optional, default 1
limit=<1-100>    optional, default 20
```

---

## Progress Status Values

| Status    | Description                              |
|-----------|------------------------------------------|
| `ACTIVE`  | Journey is ongoing                       |
| `MARRIED` | Both candidates confirmed the marriage   |

## Marriage Request Status Values

| Status      | Description                                    |
|-------------|------------------------------------------------|
| `PENDING`   | Waiting for both candidates to accept          |
| `ACCEPTED`  | Both parties accepted — progress is `MARRIED`  |
| `REJECTED`  | One party rejected                             |
| `CANCELLED` | Request was cancelled                          |
