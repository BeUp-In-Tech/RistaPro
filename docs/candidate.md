# Candidate Module

Base path: `/api/v1/candidates`

Handles candidate profile creation, updates, image management, and linked-user access management.

---

## Auth Rules

- Most endpoints require `Authorization: Bearer <accessToken>`.
- Requester must be an active linked user of the candidate profile.
- `VIEWER` access can only read; `OWNER` and `EDITOR` can write.
- Only `OWNER` can manage linked users.

---

## Constants

### `GET /constants`

Load all dropdown/select data needed for candidate profile forms.

**Auth:** Public

**Response groups:** `religionTree`, `casteTree`, `religions`, `sects`, `sectDetails`, `madhhabs`, `theologicalOrientations`, `sufiOrders`, `relationshipStatuses`, `childrenStatuses`, `moveAbroadStatuses`, `occupations`, `highestEducations`, `smokeStatuses`, `drinkStatuses`, `interests`, `interestCategories`, `personalityTraits`, `candidateCreatorRelations`, `candidateLinkedUserRelations`, `candidateLinkedUserAccessRoles`, `deprecatedGroups`

**Important:** Send the `value` keys back to the backend. Use `label` for display only.

Use `casteTree` for new cascading caste UI:

```text
Category -> Caste/Biradari/Tribe -> Clan/Sub-caste/Lineage
```

Use `religionTree` for new religious UI:

```text
Religion -> Sect -> Madhhab / Movement / Orientation
```

`casteTree` is the only caste/biradari/tribe source. Do not use separate flat caste, lineage, or tribe lists.

Frontend examples:
- Web HTML: [`docs/candidate-constants-ui-example.html`](candidate-constants-ui-example.html)
- Flutter: [`docs/candidate-constants-flutter-example.md`](candidate-constants-flutter-example.md)

---

## Candidate Identity Shape

New candidate profile writes store religious and caste values as nested ID-only objects:

```json
{
  "religious": {
    "religion": "ISLAM",
    "sect": "SUNNI",
    "sectDetail": "HANAFI",
    "madhhab": "HANAFI",
    "movement": "DEOBANDI",
    "theologicalOrientation": "BARELVI",
    "sufiOrder": "QADRI"
  },
  "casteIdentity": {
    "category": "PUNJABI",
    "caste": "JATT",
    "clan": "BAJWA"
  }
}
```

Religious flat request fields are still accepted during transition. Caste identity must be sent through `casteIdentity`.

---

## Profile Endpoints

### `POST /`

Create a candidate profile.

**Auth:** Bearer token

**Content-Type:** `application/json` or `multipart/form-data`

**Multipart file field:** `files` (multiple)

**Body:**
```json
{
  "name": "Amina",
  "dateOfBirth": "1998-05-11",
  "gender": "FEMALE",
  "religious": {
    "religion": "ISLAM",
    "sect": "SUNNI",
    "sectDetail": "HANAFI",
    "madhhab": "HANAFI",
    "movement": "DEOBANDI",
    "theologicalOrientation": "BARELVI",
    "sufiOrder": "QADRI"
  },
  "casteIdentity": {
    "category": "PUNJABI",
    "caste": "JATT",
    "clan": "BAJWA"
  },
  "relationship_status": "SINGLE",
  "occupation": "SOFTWARE_ENGINEER",
  "highest_education": "BACHELORS",
  "interests": ["PAINTING", "TRAVEL"],
  "personality": ["HONEST", "LOYAL"],
  "relationToUser": "SELF",
  "bio": "Short introduction",
  "address": "Dhaka, Bangladesh",
  "coordinates": [90.4125, 23.8103]
}
```

**Rules:**
- `name`: 2–100 chars
- `dateOfBirth`: must be in the past
- `gender`: `MALE`, `FEMALE`, or `OTHER`
- All enum fields must use constant keys from `GET /constants`
- `religious.sect` must belong to selected `religious.religion`
- `religious.sectDetail` must belong to selected `religious.religion` and `religious.sect`
- For new religious selection UIs, use `religionTree` and save selected IDs into `religious`
- `casteIdentity.category`, `casteIdentity.caste`, and `casteIdentity.clan` must follow `casteTree` hierarchy when sent together
- Caste flat fields such as `casteCategory`, `caste`, and `clan` are not accepted in new requests; use `casteIdentity`
- `interests` and `personality` cannot have duplicates
- Max 6 images per profile
- Request body is strict — unknown fields are rejected

**Response includes:** candidate profile + `labels` + `management` + `myAccess`

**Identity response fields:**
```json
{
  "religious": {
    "religion": "ISLAM",
    "sect": "SUNNI",
    "madhhab": "HANAFI",
    "movement": "DEOBANDI"
  },
  "casteIdentity": {
    "category": "PUNJABI",
    "caste": "JATT",
    "clan": "BAJWA"
  },
  "labels": {
    "religious": {
      "religion": "Islam",
      "sect": "Sunni",
      "madhhab": "Hanafi",
      "movement": "Deobandi"
    },
    "casteIdentity": {
      "category": "Punjabi",
      "caste": "Jatt",
      "clan": "Bajwa"
    }
  }
}
```

---

## Admin Migration

### `POST /admin/migrate-legacy-taxonomy`

Migrates old flat religious/caste values into the new tree fields. This does not create MongoDB collections for constants.

**Auth:** Bearer token (`ADMIN`)

**Dry run:**
```http
POST /api/v1/candidates/admin/migrate-legacy-taxonomy?dryRun=true
Authorization: Bearer <adminAccessToken>
```

**Writes migration:**
```http
POST /api/v1/candidates/admin/migrate-legacy-taxonomy
Authorization: Bearer <adminAccessToken>
```

The migration copies legacy flat candidate fields and earlier lowercase nested values into uppercase-key `religious` and `casteIdentity` fields where a safe mapping exists. It also removes old flat candidate fields (`religion`, `sect`, `sectDetail`, `madhhab`, `movement`, `theologicalOrientation`, `sufiOrder`, `casteCategory`, `caste`, `clan`, `lineage`, `tribe`) after copying them into the nested shape. Preference migration removes old `lineages`/`tribes` arrays after mapping them into `casteCategories`, `castes`, and `clans`.

**Response:**
```json
{
  "dryRun": true,
  "candidates": {
    "scanned": 120,
    "planned": 40,
    "modified": 0
  },
  "preferences": {
    "scanned": 120,
    "planned": 35,
    "modified": 0
  }
}
```

---

### `PATCH /:candidateId`

Update candidate profile fields or images.

**Auth:** Bearer token (`OWNER` or `EDITOR`)

**Content-Type:** `application/json` or `multipart/form-data`

**Multipart file field:** `files` (optional, multiple)

**Body fields (all optional):**
- Any profile field from create
- Nested updates can send only the child fields that changed, for example `religious.sect` by sending `{ "religious": { "sect": "SUNNI" } }`
- `deletedImages`: array of existing image URLs to remove
- `interests`: array of interest keys to append
- `deletedInterests`: array of interest keys to remove
- `personality`: array of personality keys to append
- `deletedPersonality`: array of personality keys to remove

**Image behavior:**
- Removes images in `deletedImages`, appends newly uploaded `files`
- Max 6 images per profile
- Removed images are queued for Cloudinary deletion via BullMQ

---

### `GET /my_linked_profiles`

Get the active candidate profile the current account can access.

**Auth:** Bearer token

---

### `GET /my_basic_profile`

Get lightweight basic info for the current account's active candidate profile.

**Auth:** Bearer token

**Response data shape:**
```json
{
  "candidate": {
    "_id": "candidate id",
    "name": "Amina",
    "gender": "FEMALE",
    "dateOfBirth": "1998-05-11T00:00:00.000Z",
    "profileImage": "https://image-url.jpg",
    "images": ["https://image-url.jpg"],
    "isActive": "ACTIVE"
  },
  "myAccess": {
    "_id": "linked user id",
    "accessRole": "OWNER",
    "relationshipToCandidate": "SELF",
    "status": "ACTIVE",
    "isPrimary": true
  }
}
```

---

### `GET /my_full_profile`

Get the current account's own full candidate profile.

**Auth:** Bearer token (`USER`)

**Notes:** Does not require Gold plan — only for the user's own profile.

---

### `GET /:targetCandidateId/full_profile`

Get the full profile of another candidate (plan-gated).

**Auth:** Bearer token (`USER`)

**Notes:**
- Only returns profiles whose owner account is active and verified.
- Requires the requester to be an active linked user of any candidate.

---

## Linked User APIs

### `GET /:candidateId/linked_users`

List linked users for a candidate profile.

**Auth:** Bearer token (any active linked user)

---

### `POST /:candidateId/linked_users`

Add a linked user (optionally creating a new account).

**Auth:** Bearer token (`OWNER` only)

**Body (create new account):**
```json
{
  "name": "Candidate Father",
  "email": "father@example.com",
  "password": "StrongPass1!",
  "relationshipToCandidate": "FATHER",
  "accessRole": "EDITOR",
  "isPrimary": false
}
```

**Body (link existing account):**
```json
{
  "name": "Candidate Father",
  "email": "father@example.com",
  "relationshipToCandidate": "FATHER",
  "accessRole": "EDITOR",
  "isPrimary": false
}
```

**Allowed `relationshipToCandidate`:** `SELF`, `FATHER`, `MOTHER`, `BROTHER`, `SISTER`, `GUARDIAN`, `RELATIVE`, `CONSULTANT`, `OTHER`

**Allowed `accessRole`:** `OWNER`, `EDITOR`, `VIEWER`

---

### `PATCH /:candidateId/linked_users/:linkedUserId`

Update a linked user's relation or access role.

**Auth:** Bearer token (`OWNER` only)

**Body:**
```json
{
  "accessRole": "OWNER",
  "isPrimary": true
}
```

---

### `DELETE /:candidateId/linked_users/:linkedUserId`

Remove a linked user from a candidate profile.

**Auth:** Bearer token (`OWNER` only)

**Safety rules:**
- Primary linked user cannot be removed directly.
- Last active owner cannot be removed.
