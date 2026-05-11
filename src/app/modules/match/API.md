# Match Module API

Base path: `/api/v1/matches`

This module exposes candidate-to-candidate matches created by mutual positive swipe actions.

## Security Rules

- All endpoints require `Authorization: Bearer <accessToken>`.
- The requester must be an active linked user of at least one candidate in the match.
- `OWNER`, `EDITOR`, and `VIEWER` users can read matches.
- Only `OWNER` and `EDITOR` users can unmatch.

## Match Lifecycle

- Candidate A `LIKE` or `SUPER_LIKE` candidate B.
- Candidate B `LIKE` or `SUPER_LIKE` candidate A.
- The second positive action creates or returns one active `Match`.
- The same flow creates or returns one `Conversation`.
- The conversation id is returned as `match.conversation`.
- `PATCH /:matchId/unmatch` marks the match as `UNMATCHED` and archives the open conversation.

## `GET /`

Purpose:

- List active matches for one candidate profile.

Query:

```txt
candidateId=<candidateId>   required
```

Example:

```http
GET /api/v1/matches?candidateId=665f1a2b3c4d5e6f78901234
Authorization: Bearer <accessToken>
```

Response:

```json
[
  {
    "_id": "match id",
    "candidates": [
      {
        "_id": "candidate id",
        "name": "Amina",
        "age": 24,
        "gender": "FEMALE",
        "images": ["https://image-url.jpg"],
        "livesIn": "Dhaka",
        "religion": "ISLAM"
      }
    ],
    "conversation": "conversation id",
    "matchedBy": "candidate id",
    "pairKey": "candidateA_candidateB",
    "status": "ACTIVE",
    "createdAt": "2026-05-11T00:00:00.000Z",
    "updatedAt": "2026-05-11T00:00:00.000Z"
  }
]
```

## `GET /:matchId`

Purpose:

- Get one match detail after access checking.

Query:

```txt
candidateId=<candidateId>   optional but recommended
```

Example:

```http
GET /api/v1/matches/665f1a2b3c4d5e6f78909999?candidateId=665f1a2b3c4d5e6f78901234
Authorization: Bearer <accessToken>
```

## `PATCH /:matchId/unmatch`

Purpose:

- End an active match without deleting match history.

Query:

```txt
candidateId=<candidateId>   optional but recommended
```

Example:

```http
PATCH /api/v1/matches/665f1a2b3c4d5e6f78909999/unmatch?candidateId=665f1a2b3c4d5e6f78901234
Authorization: Bearer <accessToken>
```

Behavior:

- `data.status` becomes `UNMATCHED`.
- the linked open conversation is archived.
- the match no longer appears in `GET /matches?candidateId=<candidateId>`.
