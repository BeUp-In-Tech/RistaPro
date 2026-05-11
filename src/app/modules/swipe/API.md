# Swipe Module API

Base path: `/api/v1/swipes`

This module powers the Tinder-style discovery feed and swipe actions.

## Security Rules

- All endpoints require `Authorization: Bearer <accessToken>`.
- The requester must be an active linked user of the `candidateId`.
- `OWNER`, `EDITOR`, and `VIEWER` can view the feed.
- `OWNER` and `EDITOR` can perform swipe actions.
- `VIEWER` cannot like, super-like, or pass.
- Targets must be active candidates whose owner user is active, verified, and not deleted.
- Reports and active matches block new swipe actions between the same two candidates.

## `GET /feed`

Purpose:

- Return recommended candidate cards for one candidate profile.
- Exclude the candidate's own profile.
- Exclude candidates already liked, super-liked, passed, matched, or reported by/against this candidate.
- Apply candidate preferences from `candidate-preferences`.
- Rank candidates by match score and return a Tinder-style card stack.

Query:

```txt
candidateId=<candidateId>   required
limit=<1-50>                optional, default 20
cursor=<nextCursor>         optional, returned by previous feed response
```

Example:

```http
GET /api/v1/swipes/feed?candidateId=665f1a2b3c4d5e6f78901234&limit=20
Authorization: Bearer <accessToken>
```

Response:

```json
{
  "cards": [
    {
      "_id": "candidate id",
      "name": "Amina",
      "age": 24,
      "gender": "FEMALE",
      "images": ["https://image-url.jpg"],
      "labels": {},
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

## Recommendation Logic

Hard exclusions:

- inactive candidates
- own candidate profile
- already acted profiles from `Like`
- already matched candidates from `Match`
- reported candidates from `Report`
- candidates whose owner account is not verified

Strict preference filters:

- gender, when `strictFilters.gender` is true
- age, when age values exist
- height, when `strictFilters.height` is true
- religion, when `strictFilters.religion` is true
- caste, when `strictFilters.caste` is true
- location distance, when `strictFilters.location` is true

Soft scoring:

- gender match
- age range match
- religion, sect, and caste match
- height range match
- education and occupation match
- relationship, children, move abroad, smoke, and drink preferences
- shared interests
- shared personality traits
- preferred distance
- admin verification
- richer profiles with images and bio

## Relaxed Fallback

If strict filters return too few candidates, the endpoint relaxes optional strict filters and sets:

```json
{
  "relaxed": true,
  "relaxedReason": "Not enough candidates matched all strict preferences"
}
```

This keeps the feed alive instead of returning an empty stack too quickly.

## Pagination

The first request builds a ranked feed session and caches candidate IDs briefly in Redis. The `nextCursor` points to the next slice of that ranked session.

If Redis is unavailable, the first page still works, but `nextCursor` may be `null`.

## `POST /action`

Purpose:

- Store one Tinder-style action from one candidate profile to another.
- Hide acted profiles from future feed responses.
- Consume quota for positive actions.
- Create a match when the target candidate already liked or super-liked back.

Body:

```json
{
  "candidateId": "665f1a2b3c4d5e6f78901234",
  "targetCandidateId": "665f1a2b3c4d5e6f78905678",
  "type": "LIKE",
  "source": "FEED"
}
```

Fields:

- `candidateId`: the acting candidate profile owned/managed by the logged-in user
- `targetCandidateId`: the profile being liked, super-liked, or passed
- `type`: `LIKE`, `SUPER_LIKE`, or `PASS`
- `source`: optional, defaults to `FEED`; allowed values are `FEED`, `LIKES_ME`, `PROFILE`

Example:

```http
POST /api/v1/swipes/action
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Response:

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
    "matchedBy": "candidate id that completed the match",
    "conversation": "conversation id"
  },
  "quota": {
    "dailyLikeRemaining": 49,
    "superLikeRemaining": 10,
    "nextResetAt": "2026-04-22T18:00:00.000Z"
  }
}
```

Action behavior:

- `PASS` is free and never creates a match.
- `LIKE` consumes one normal daily like.
- `SUPER_LIKE` consumes one super-like.
- `LIKE` and `SUPER_LIKE` both count as positive actions for mutual matching.
- If the target already has a positive action toward this candidate, the API creates or returns one active match.
- The same action is idempotent for safe frontend retry.
- A different second action toward the same target is rejected; undo/unmatch should be a separate explicit feature later.
- After a successful new action, the actor candidate's Redis feed sessions are cleared so old cursor pages do not show stale profiles.

## Postman Smoke Test

Use two logged-in users with one active candidate profile each.

Environment variables:

```txt
baseUrl=http://localhost:3000/api/v1
tokenA=
tokenB=
candidateA=
candidateB=
matchId=
conversationId=
```

Steps:

1. Login account A with `POST {{baseUrl}}/auth/login`, then save `data.accessToken` as `tokenA`.
2. Call `GET {{baseUrl}}/candidates/my_linked_profiles` with `tokenA`, then save `data[0].candidate._id` as `candidateA`.
3. Repeat the same two requests for account B, saving `tokenB` and `candidateB`.
4. Call `GET {{baseUrl}}/swipes/feed?candidateId={{candidateA}}&limit=20` with `tokenA` to confirm feed loading.
5. Candidate A likes candidate B with `POST {{baseUrl}}/swipes/action` using `tokenA`.
6. Candidate B likes candidate A with `POST {{baseUrl}}/swipes/action` using `tokenB`.
7. The second positive swipe should return `matched: true`, `match._id`, and `match.conversation`.
8. Confirm the match with `GET {{baseUrl}}/matches?candidateId={{candidateA}}`.

Candidate A action body:

```json
{
  "candidateId": "{{candidateA}}",
  "targetCandidateId": "{{candidateB}}",
  "type": "LIKE",
  "source": "FEED"
}
```

Candidate B action body:

```json
{
  "candidateId": "{{candidateB}}",
  "targetCandidateId": "{{candidateA}}",
  "type": "LIKE",
  "source": "FEED"
}
```
