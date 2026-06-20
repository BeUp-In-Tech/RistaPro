# Swipe Module

Base path: `/api/v1/swipes`

Powers the Tinder-style candidate discovery feed, nearby match search, and swipe actions.

---

## Auth Rules

- All endpoints require `Authorization: Bearer <accessToken>`.
- Requester must be an active linked user of `candidateId`.
- `OWNER`, `EDITOR`, and `VIEWER` can view the feed.
- Only `OWNER` and `EDITOR` can perform swipe actions.

---

## Endpoints

### `GET /feed`

Return a ranked candidate stack for one candidate profile.

**Auth:** Bearer token

**Query params:**

| Param | Required | Default | Notes |
|-------|----------|---------|-------|
| `candidateId` | Yes | — | |
| `limit` | No | `20` | Max `50` |
| `cursor` | No | — | Cursor from previous response for pagination |

**Example:**
```http
GET /api/v1/swipes/feed?candidateId=665f1a2b3c4d5e6f78901234&limit=20
Authorization: Bearer <accessToken>
```

**Response data shape:**
```json
{
  "cards": [
    {
      "_id": "candidate id",
      "name": "Amina",
      "age": 24,
      "gender": "FEMALE",
      "images": ["https://image-url.jpg"],
      "labels": {
        "religious": {
          "religion": "Islam",
          "sect": "Sunni",
          "madhhab": "Hanafi"
        },
        "casteIdentity": {
          "category": "Punjabi",
          "caste": "Jatt",
          "clan": "Bajwa"
        }
      },
      "livesIn": "Dhaka",
      "distanceKm": 8.4,
      "matchScore": 92,
      "personality": ["HONEST"],
      "religion": "ISLAM"
    }
  ],
  "limit": 20,
  "nextCursor": "cursor token or null",
  "relaxed": false
}
```

**Notes:**
- Excludes own profile, already-acted profiles, matched profiles, and reported profiles.
- Strict filters remove candidates; soft preferences add match score.
- Religion preferences match candidate `religious.*` fields.
- Caste preferences match candidate `casteIdentity.*` fields.
- Caste matching uses nested `casteIdentity` fields.
- If too few results, optional filters are relaxed and `relaxed: true` is returned.
- First page builds a Redis feed session for fast cursor pagination.

---

### `GET /nearby-matches`

Return preference-matching candidates near the requester's location.

**Auth:** Bearer token

**Query params:**

| Param | Required | Default | Notes |
|-------|----------|---------|-------|
| `candidateId` | Yes | — | |
| `radiusKm` | No | preference `maxDistanceKm` or `25` | |
| `page` | No | `1` | |
| `limit` | No | `20` | Max `50` |

**Response:**
```json
{
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 12,
    "totalPage": 1,
    "radiusKm": 25,
    "origin": "SAVED_PROFILE_LOCATION",
    "currentLocation": "Dhaka, Bangladesh"
  },
  "data": [
    {
      "_id": "candidate id",
      "name": "Amina",
      "age": 24,
      "gender": "FEMALE",
      "images": ["https://image-url.jpg"],
      "livesIn": "Dhaka",
      "distanceKm": 8.4,
      "matchScore": 72,
      "religion": "ISLAM",
      "labels": {
        "religious": {
          "religion": "Islam"
        },
        "casteIdentity": {
          "category": "Punjabi"
        }
      }
    }
  ]
}
```

**Notes:**
- Backend reverse-geocodes requester coordinates with OpenStreetMap Nominatim.
- Nearby matching uses the same nested `religious` and `casteIdentity` candidate fields as the feed.
- Geocoding failure does not fail the request; `currentLocation` becomes `null`.
- Coordinates are never saved to the candidate profile from this API.

---

### `POST /action`

Save one swipe action (like, super-like, or pass).

**Auth:** Bearer token (`OWNER` or `EDITOR`)

**Body:**
```json
{
  "candidateId": "665f1a2b3c4d5e6f78901234",
  "targetCandidateId": "665f1a2b3c4d5e6f78905678",
  "type": "LIKE",
  "source": "FEED"
}
```

**Allowed values:**
- `type`: `LIKE`, `SUPER_LIKE`, `PASS`
- `source`: optional — `FEED`, `LIKES_ME`, or `PROFILE` (defaults to `FEED`)

**Behavior:**
- `PASS` is free; no match created.
- `LIKE` consumes one daily like.
- `SUPER_LIKE` consumes one super-like.
- Mutual `LIKE`/`SUPER_LIKE` creates or returns an active match and conversation.
- Duplicate same-action retries are safe; changing a previous action is rejected.

**Response data shape:**
```json
{
  "action": {
    "_id": "swipe action id",
    "type": "LIKE",
    "source": "FEED",
    "likedBy": "acting candidate id",
    "likedProfile": "target candidate id",
    "actedBy": "logged-in user id",
    "isActive": true
  },
  "matched": true,
  "match": {
    "_id": "match id",
    "candidates": ["candidate a", "candidate b"],
    "pairKey": "candidateA_candidateB",
    "status": "ACTIVE",
    "matchedBy": "candidate id",
    "conversation": "conversation id"
  },
  "quota": {
    "dailyLikeRemaining": 49,
    "superLikeRemaining": 10,
    "nextResetAt": "2026-04-22T18:00:00.000Z"
  }
}
```
