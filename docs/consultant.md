# Consultant Module API

Base path: `/api/v1/consultant`

This module manages consultation cases, in-case messaging, candidate invitations, guest access, and marriage records. It works alongside the Meeting Schedule module — requesting a meeting automatically creates or reuses a linked case.

## Security Rules

- Most endpoints require `Authorization: Bearer <accessToken>`.
- Guest invite endpoints (`/guest-invites/:token/...`) use a secure URL token instead of auth headers — no account required.
- Consultant features (`canUseConsultant`) are available on the **Platinum plan** only.
- `VIEWER` linked users cannot perform write actions (send messages, start cases, etc.).
- Only the `CONSULTANT` role can create cases manually, add candidates, create guest invites, and record marriages.

---

## Available Consultants

### `GET /available`

Lists all active consultant accounts for a candidate to choose from.

Role: `USER`

Query:

```txt
candidateId=<candidateId>   required
```

Response: array of consultant user objects (`_id`, `full_name`, `email`, `picture`, `isVerified`, `role`)

---

## Consultation Cases

A **case** is the central workspace for a matchmaking effort. It can contain one or two candidates plus the consultant, and optionally guest (family) participants.

### Case Lifecycle

1. Starts with Consultant + Candidate A
2. Consultant adds or invites Candidate B
3. Both candidates and consultant chat inside the case
4. Consultant generates guest invite links for family members
5. If successful, consultant records a marriage and the case is marked `MARRIED`

### `POST /cases/start`

Candidate starts a consultation case with a chosen consultant. Creates or reuses an open case.

Role: `USER`

Body:

```json
{
  "candidateId": "candidateId",
  "consultantId": "consultantUserId",
  "title": "Optional title",
  "note": "Optional note"
}
```

Response: populated consultation case with `candidates` array.

### `POST /cases`

Consultant manually creates a case with one or two already-assigned candidates.

Role: `CONSULTANT`

Body:

```json
{
  "candidateIds": ["candidateA", "candidateB"],
  "title": "Optional title",
  "note": "Optional note"
}
```

- `candidateIds`: 1–2 unique candidate IDs. Each must already be assigned to this consultant.

### `GET /cases`

Lists consultation cases for the authenticated user.

Role: `USER`, `CONSULTANT`

Query:

```txt
candidateId=<candidateId>              required for USER role
status=OPEN|ARCHIVED|MARRIED           optional
```

### `GET /cases/:caseId`

Returns details of a single consultation case.

Role: `USER`, `CONSULTANT`

---

## Candidate Management Inside a Case

### `POST /cases/:caseId/candidates`

Consultant directly adds a second registered candidate to an open case.

Role: `CONSULTANT`

Body:

```json
{
  "candidateId": "candidateId"
}
```

- Case must be `OPEN` and have fewer than 2 candidates.
- Candidate must be already assigned to the consultant.

### `POST /cases/:caseId/candidate-invites`

Consultant sends an invitation to a registered candidate to join a case.

Role: `CONSULTANT`

Body:

```json
{
  "candidateId": "candidateId"
}
```

Behavior:

- Sends a push notification to the candidate's OWNER/EDITOR linked users.
- A pending invite already exists for the same candidate and case will be reused (idempotent).

### `POST /candidate-invites/:inviteId/accept`

Candidate accepts the consultant's case invitation.

Role: `USER`

Behavior:

- Adds the candidate to the case.
- Creates a consultant assignment for the candidate if one doesn't exist.
- Sends a push notification to the consultant.

### `POST /candidate-invites/:inviteId/decline`

Candidate declines the consultant's case invitation.

Role: `USER`

Behavior:

- Marks the invite as `DECLINED`.
- Sends a push notification to the consultant.

---

## Case Messaging

### `GET /cases/:caseId/messages`

Returns paginated messages for a case.

Role: `USER`, `CONSULTANT`

Query:

```txt
page=<number>    optional, default 1
limit=<1-100>    optional, default 20
```

### `POST /cases/:caseId/messages`

Sends a message in a consultation case.

Role: `USER`, `CONSULTANT`

Body:

```json
{
  "candidateId": "candidateId",
  "message": "Message text up to 3000 chars"
}
```

- `candidateId` is required for `USER` role. Omit for `CONSULTANT`.

---

## Guest Invites

Allows family members without an account to participate in a case.

### `POST /cases/:caseId/guest-invites`

Consultant generates a secure, expiring guest invite link.

Role: `CONSULTANT`

Body:

```json
{
  "displayName": "Guest display name",
  "contact": "Optional phone or email",
  "expiresAt": "2025-12-31T00:00:00.000Z"
}
```

- `expiresAt` defaults to 7 days if not provided.
- Returns a token used in all guest endpoints below.

---

### Guest Endpoints (No Auth — Token Based)

#### `GET /guest-invites/:token`

Returns the case summary for the guest. Automatically records the guest as a participant on first access.

#### `GET /guest-invites/:token/messages`

Returns case messages visible to the guest.

#### `POST /guest-invites/:token/messages`

Guest sends a message in the case.

Body:

```json
{
  "message": "Message text up to 3000 chars"
}
```

#### `POST /guest-invites/:token/meetings/:meetingId/join`

Guest joins a formal meeting call for the linked case. Returns Agora RTC credentials.

Response:

```json
{
  "agora": {
    "appId": "agoraAppId",
    "channelName": "meeting_<meetingId>",
    "uid": 123456789,
    "token": "agoraRtcToken",
    "expiresAt": "2025-06-10T12:00:00.000Z"
  },
  "meeting": { ... }
}
```

---

## Marriage Records

### `POST /marriage-records`

Consultant records a successful marriage outcome.

Role: `CONSULTANT`

Body:

```json
{
  "caseId": "caseId",
  "marriedAt": "2025-06-01T00:00:00.000Z",
  "note": "Optional note",
  "parties": [
    {
      "partyType": "CANDIDATE",
      "candidateId": "candidateAId"
    },
    {
      "partyType": "CANDIDATE",
      "candidateId": "candidateBId"
    }
  ]
}
```

- Exactly 2 parties are required.
- `partyType` can be `CANDIDATE` or `GUEST`.
- For `GUEST` party: provide `guestInviteId` or `displayName` + `contact` instead of `candidateId`.
- If both parties are candidates linked to a `RishtaProgress`, the progress is finalized.

### `GET /marriage-records`

Lists marriage records created by the authenticated consultant.

Role: `CONSULTANT`

Query:

```txt
caseId=<caseId>    optional
page=<number>      optional
limit=<1-100>      optional
```

---

## Case Status Values

| Status     | Description                              |
|------------|------------------------------------------|
| `OPEN`     | Active case — messages and meetings work |
| `ARCHIVED` | Closed without a marriage outcome        |
| `MARRIED`  | Successful match — marriage recorded     |
