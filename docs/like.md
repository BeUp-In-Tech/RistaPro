# Like Module API

Base path: `/api/v1/likes`

This module returns the list of profiles that liked or were liked by a candidate. Likes are created internally by the swipe module — there is no direct "create like" endpoint here.

## Security Rules

- All endpoints require `Authorization: Bearer <accessToken>`.
- The requester must be a linked user of the provided `candidateId`.

---

## Like Types

| Type         | Description                    |
|--------------|-------------------------------|
| `LIKE`       | Standard like                  |
| `SUPER_LIKE` | Super like (higher priority)   |
| `PASS`       | Candidate was passed/skipped   |

---

## `GET /received`

Returns profiles that liked the authenticated candidate (i.e. the candidate's incoming likes).

Auth: `USER`, `ADMIN`

Query:

```txt
candidateId=<candidateId>   required
page=<number>               optional, default 1
limit=<1-100>               optional, default 20
type=LIKE|SUPER_LIKE        optional — filter by like type
sort=<field>                optional
```

Response:

```json
{
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 12,
    "totalPage": 1
  },
  "data": [
    {
      "_id": "likeId",
      "type": "LIKE",
      "source": "FEED",
      "candidate": {
        "_id": "candidateId",
        "name": "Ahmed",
        "age": 27,
        "gender": "MALE",
        "images": ["https://res.cloudinary.com/..."],
        "livesIn": "London",
        "religion": "muslim"
      },
      "createdAt": "2026-06-10T10:00:00.000Z"
    }
  ]
}
```

---

## `GET /sent`

Returns profiles that the authenticated candidate has liked.

Auth: `USER`, `ADMIN`

Query:

```txt
candidateId=<candidateId>   required
page=<number>               optional, default 1
limit=<1-100>               optional, default 20
type=LIKE|SUPER_LIKE        optional — filter by like type
sort=<field>                optional
```

Same response shape as `GET /received`, but `candidate` refers to the profile that was liked.

---

## Like Source Values

| Source       | Description                              |
|--------------|------------------------------------------|
| `FEED`       | Like made from the swipe/discovery feed  |
| `LIKES_ME`   | Like made from the "Likes Me" section    |
| `PROFILE`    | Like made from a candidate's profile     |
