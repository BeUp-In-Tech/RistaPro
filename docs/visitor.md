# Visitor Module API

Base path: `/api/v1/visitors`

This module tracks profile views and returns the list of candidates who have visited a profile. Each visit is deduplicated per visitor — repeat visits increment a `visitCount` and update `lastVisitedAt` rather than creating duplicate records.

## Security Rules

- All endpoints require `Authorization: Bearer <accessToken>`.
- The requester must be a linked user of the provided `candidateId`.

---

## `POST /track`

Tracks a profile view. Call this when a user opens another candidate's profile page.

Auth: `USER`

Body:

```json
{
  "candidateId": "viewerCandidateId",
  "visitedProfileId": "profileBeingViewedCandidateId"
}
```

- `candidateId` — the candidate doing the viewing
- `visitedProfileId` — the candidate whose profile is being viewed
- If the same pair already has a visitor record, `visitCount` is incremented and `lastVisitedAt` is updated. No duplicate record is created.
- A candidate visiting their own profile is ignored.

Response: the visitor record (created or updated).

---

## `GET /`

Returns a paginated list of candidates who have visited the authenticated candidate's profile, sorted by most recent visit.

Auth: `USER`

Query:

```txt
candidateId=<candidateId>   required
page=<number>               optional, default 1
limit=<1-100>               optional, default 20
```

Response:

```json
{
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 8,
    "totalPage": 1
  },
  "data": [
    {
      "_id": "visitorId",
      "name": "Ahmed",
      "age": 27,
      "gender": "MALE",
      "images": ["https://res.cloudinary.com/..."],
      "livesIn": "London",
      "religion": "muslim",
      "occupation": "engineer",
      "badge": true,
      "visitCount": 3,
      "lastVisitedAt": "2026-06-10T10:00:00.000Z"
    }
  ]
}
```

| Field           | Description                                           |
|-----------------|-------------------------------------------------------|
| `visitCount`    | Total number of times this visitor viewed the profile |
| `lastVisitedAt` | Timestamp of the most recent visit                    |
| `badge`         | `true` if the visitor has a verified badge            |
