# Candidate Preference Module

Base path: `/api/v1/candidate-preferences`

Stores partner preferences used by the swipe/feed ranking system.

---

## Auth Rules

- All endpoints require `Authorization: Bearer <accessToken>`.
- Requester must be an active linked user of the candidate profile.
- `VIEWER` can read only.
- `OWNER` and `EDITOR` can create, replace, or update preferences.

---

## Notes

- `GET` uses a short Redis cache after authorization; writes invalidate the cache.
- Preferences are auto-created with safe defaults when a candidate profile is created.
- `MALE` candidates default to `preferredGenders: ["FEMALE"]`, `FEMALE` to `["MALE"]`, `OTHER` to `["MALE","FEMALE","OTHER"]`.

---

## Endpoints

### `GET /:candidateId`

Get partner preferences for a candidate profile. If none exist, defaults are created and returned.

**Auth:** Bearer token (any active linked user)

**Example:**
```http
GET /api/v1/candidate-preferences/665f1a2b3c4d5e6f78901234
Authorization: Bearer <accessToken>
```

---

### `PUT /:candidateId`

Replace the full preference document.

**Auth:** Bearer token (`OWNER` or `EDITOR`)

**Body:**
```json
{
  "preferredGenders": ["FEMALE"],
  "ageMin": 22,
  "ageMax": 32,
  "heightMin": 150,
  "heightMax": 180,
  "religions": ["ISLAM"],
  "sects": ["SUNNI"],
  "castes": ["BENGALI"],
  "relationship_statuses": ["SINGLE"],
  "have_children": ["NONE"],
  "move_abroad": ["YES", "MAYBE"],
  "occupations": ["SOFTWARE_ENGINEER"],
  "highest_educations": ["BACHELORS"],
  "smoke_statuses": ["NEVER"],
  "drink_statuses": ["NEVER"],
  "interests": ["TRAVEL"],
  "personality": ["HONEST"],
  "maxDistanceKm": 50,
  "strictFilters": {
    "gender": true,
    "age": true,
    "height": false,
    "religion": false,
    "caste": false,
    "location": false
  }
}
```

---

### `PATCH /:candidateId`

Partially update preferences. Only sent fields are changed. Send `null` for nullable number fields to clear them.

**Auth:** Bearer token (`OWNER` or `EDITOR`)

**Body:**
```json
{
  "ageMin": 24,
  "ageMax": 34,
  "maxDistanceKm": null,
  "strictFilters": {
    "age": true,
    "location": false
  }
}
```

**Validation rules:**
- `ageMin` cannot be greater than `ageMax`
- `heightMin` cannot be greater than `heightMax`
- If both `religions` and `sects` are sent, every sect must belong to a selected religion
- Arrays cannot contain duplicate values
- Enum values must use constant keys from `GET /candidates/constants`
- At least one preference field required in patch
