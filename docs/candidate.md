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

**Response groups:** `religions`, `sects`, `castes`, `relationshipStatuses`, `childrenStatuses`, `moveAbroadStatuses`, `occupations`, `highestEducations`, `smokeStatuses`, `drinkStatuses`, `interests`, `interestCategories`, `personalityTraits`, `candidateCreatorRelations`, `candidateLinkedUserRelations`, `candidateLinkedUserAccessRoles`

**Important:** Send the `value` keys back to the backend. Use `label` for display only.

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
  "religion": "ISLAM",
  "sect": "SUNNI",
  "caste": "BENGALI",
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
- `sect` must belong to selected `religion`
- `interests` and `personality` cannot have duplicates
- Max 6 images per profile
- Request body is strict — unknown fields are rejected

**Response includes:** candidate profile + `labels` + `management` + `myAccess`

---

### `PATCH /:candidateId`

Update candidate profile fields or images.

**Auth:** Bearer token (`OWNER` or `EDITOR`)

**Content-Type:** `application/json` or `multipart/form-data`

**Multipart file field:** `files` (optional, multiple)

**Body fields (all optional):**
- Any profile field from create
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
