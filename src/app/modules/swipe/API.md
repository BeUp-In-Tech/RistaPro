# Swipe Module API

Base path: `/api/v1/swipes`

This module powers the Tinder-style discovery feed. Phase 2 includes the feed endpoint only. Like, super-like, and pass actions belong to the next phase.

## Security Rules

- All endpoints require `Authorization: Bearer <accessToken>`.
- The requester must be an active linked user of the `candidateId`.
- `OWNER`, `EDITOR`, and `VIEWER` can view the feed.
- Mutation permissions are intentionally not handled here because this phase does not create swipe actions.

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
      "height": 160,
      "religion": "ISLAM",
      "sect": "SUNNI",
      "caste": "BENGALI",
      "occupation": "HOMEMAKER",
      "highest_education": "BACHELORS",
      "interests": ["TRAVEL"],
      "personality": ["HONEST"],
      "bio": "Short bio",
      "images": ["https://image-url.jpg"],
      "labels": {},
      "matchScore": 92,
      "scoreReasons": [
        "Gender matches your preference",
        "Age matches your preference",
        "Religion matches your preference"
      ],
      "isSuperLike": false
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
