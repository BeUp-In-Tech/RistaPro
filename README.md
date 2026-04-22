# RistaPro API Guide

This README documents the API modules that are currently mounted under `/api/v1`.

Active modules today:
- `auth`
- `users`
- `plans`
- `candidates`
- `candidate-preferences`
- `swipes`

Other route files may exist in the codebase, but they are not publicly available until they are mounted in the main router.

## Base URL

Local example:

```text
http://localhost:<PORT>/api/v1
```

## Auth Rules

- Protected endpoints require `Authorization: Bearer <accessToken>`.
- `refreshToken` is stored in an HTTP-only cookie and is used by `GET /auth/get_new_access_token`.
- `accessToken` may also be returned in the response body for login and Google callback flows.
- Most protected routes accept all platform roles unless the route explicitly says `ADMIN` only.

## Common Response Shape

Successful responses follow this shape:

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Human readable message",
  "data": {},
  "meta": {}
}
```

Error responses follow this shape:

```json
{
  "success": false,
  "message": "Error message",
  "errorSources": [],
  "err": null,
  "stack": null
}
```

## Multipart Request Note

Some routes accept file upload through `multer`.

For multipart requests:
- send files in the file field used by the route
- send the non-file payload inside a `data` field as a JSON string

Example:

```text
Content-Type: multipart/form-data
file: <binary file>
data: {"full_name":"Nayem Ahmed"}
```

For candidate image uploads:

```text
Content-Type: multipart/form-data
files: <multiple binary files>
data: {"name":"Amina","dateOfBirth":"1998-05-11","gender":"FEMALE"}
```

## Quick Start Flows

### 1. User login with Google

1. Open `GET /auth/google`
2. Complete Google login
3. Read the returned access token from redirect or cookies
4. Use `Authorization: Bearer <accessToken>` for protected routes

### 2. Admin creates consultant

1. Admin logs in
2. Call `POST /users`
3. Consultant then logs in with email and password using `POST /auth/login`

### 3. User creates candidate profile

1. Load constants from `GET /candidates/constants`
2. Pick option `value` keys from the response
3. Create profile with `POST /candidates`
4. Review or update partner preferences with `GET /candidate-preferences/:candidateId`
5. Load recommended profiles with `GET /swipes/feed?candidateId=<candidateId>`
6. If needed, add family members with linked-user APIs

### 4. Guardian-managed candidate profile

1. Guardian logs in
2. Create candidate using `relationToUser`
3. Add other linked users with `POST /candidates/:candidateId/linked-users` (link existing account or create new account with `name + email + password`)
4. Candidate owner can load basic profile info from `GET /candidates/my_basic_profile`
5. Candidate owner can load the full managed candidate access from `GET /candidates/my_linked_profiles`

---

## Auth Module

Base path: `/api/v1/auth`

### `GET /google`

Purpose:
- Start Google OAuth login

Auth:
- Public

Query:
- `redirect` optional frontend path or state value

How to use:
- Open this URL in browser or mobile webview

### `GET /google/callback`

Purpose:
- OAuth callback from Google

Auth:
- Public

What it does:
- creates user automatically if not found
- sets auth cookies
- redirects to frontend or deep link with token

### `POST /login`

Purpose:
- Login with email and password

Auth:
- Public

Body:

```json
{
  "email": "consultant@example.com",
  "password": "StrongPass1!"
}
```

Notes:
- local strategy uses `email` and `password`
- good for consultant or other accounts that have password set

### `PATCH /change_password`

Purpose:
- Change password for logged-in user

Auth:
- Bearer token

Body:

```json
{
  "oldPassword": "OldPass1!",
  "newPassword": "NewPass1!"
}
```

### `POST /forget_password`

Purpose:
- Request password reset OTP

Auth:
- Public

Body:

```json
{
  "email": "consultant@example.com"
}
```

### `POST /verify_forget_password_otp`

Purpose:
- Verify reset OTP and receive reset token

Auth:
- Public

Body:

```json
{
  "email": "consultant@example.com",
  "otp": "123456"
}
```

### `POST /reset_password`

Purpose:
- Reset password after OTP verification

Auth:
- Public

Headers:
- `token: <otp-verification-token>`

Body:

```json
{
  "newPassword": "NewPass1!"
}
```

### `GET /get_new_access_token`

Purpose:
- Rotate access and refresh token

Auth:
- Bearer token in current codebase, and refresh cookie must exist

Notes:
- route reads refresh token from cookie
- returns both `newAccessToken` and `newRefreshToken`

---

## User Module

Base path: `/api/v1/users`

## Authenticated User Endpoints

### `GET /me`

Purpose:
- Get logged-in user profile

Auth:
- Bearer token

### `PATCH /me`

Purpose:
- Update logged-in user profile

Auth:
- Bearer token

Content type:
- `application/json` or `multipart/form-data`

Body:

```json
{
  "full_name": "Nayem Ahmed"
}
```

Multipart file field:
- `file`

Allowed fields:
- `full_name`
- `picture`

### `POST /me/send_verification_otp`

Purpose:
- Send profile verification OTP

Auth:
- Bearer token

### `POST /me/verify_profile`

Purpose:
- Verify profile with OTP

Auth:
- Bearer token

Body:

```json
{
  "otp": "123456"
}
```

### `GET /devices`

Purpose:
- List logged-in user devices

Auth:
- Bearer token

### `POST /devices`

Purpose:
- Register FCM device token

Auth:
- Bearer token

Body:

```json
{
  "token": "firebase-device-token",
  "platform": "ANDROID",
  "deviceId": "device-123",
  "deviceName": "Pixel 8"
}
```

Allowed `platform` values:
- `WEB`
- `IOS`
- `ANDROID`

### `PATCH /devices/:deviceId/inactive`

Purpose:
- Deactivate a device token

Auth:
- Bearer token

## Admin Endpoints

### `POST /`

Purpose:
- Create consultant account

Auth:
- `ADMIN` only

Body:

```json
{
  "full_name": "Consultant One",
  "email": "consultant@example.com",
  "password": "StrongPass1!"
}
```

Validation:
- `full_name`: 3 to 100 chars
- `email`: valid email
- `password`: minimum 6 chars, at least 1 uppercase, 1 number, 1 special character

### `GET /`

Purpose:
- List users

Auth:
- `ADMIN` only

Useful query params:
- `page`
- `limit`
- `sort`
- `fields`
- `searchTerm`
- direct field filters like `role`, `isActive`, `isVerified`

### `GET /:id`

Purpose:
- Get single user by ID

Auth:
- `ADMIN` only

### `PATCH /:id`

Purpose:
- Update user by admin

Auth:
- `ADMIN` only

Content type:
- `application/json` or `multipart/form-data`

Allowed fields:
- `full_name`
- `picture`
- `plan`
- `isVerified`
- `isActive`

Multipart file field:
- `file`

### `DELETE /:id`

Purpose:
- Soft delete user

Auth:
- `ADMIN` only

Notes:
- admin cannot delete own account from this route

---

## Plan Module

Base path: `/api/v1/plans`

Available plan keys:
- `free`
- `gold`
- `platinum`

### `GET /`

Purpose:
- List all plans

Auth:
- Public

### `GET /:planType`

Purpose:
- Get single plan

Auth:
- Public

### `POST /`

Purpose:
- Create plan config

Auth:
- `ADMIN` only

Body:

```json
{
  "planType": "gold",
  "price": 19.99
}
```

Rules:
- `free` must have `price = 0`
- paid plans must have `price > 0`

### `PATCH /:planType`

Purpose:
- Update plan config

Auth:
- `ADMIN` only

Body:

```json
{
  "price": 29.99,
  "isActive": true
}
```

---

## Candidate Module

Base path: `/api/v1/candidates`

This module currently includes:
- candidate constant data
- candidate profile creation
- linked-user access management

## Constants

### `GET /constants`

Purpose:
- Load all frontend dropdown and select data needed for candidate profile forms

Auth:
- Public

Main response groups:
- `religions`
- `sects`
- `castes`
- `relationshipStatuses`
- `childrenStatuses`
- `moveAbroadStatuses`
- `occupations`
- `highestEducations`
- `smokeStatuses`
- `drinkStatuses`
- `interests`
- `interestCategories`
- `personalityTraits`
- `candidateCreatorRelations`
- `candidateLinkedUserRelations`
- `candidateLinkedUserAccessRoles`

Important:
- send the returned `value` keys back to the backend
- use `label` only for display

## Candidate Profile Create

### `POST /`

Purpose:
- Create candidate profile for self or as guardian/relative

Auth:
- Bearer token

Content type:
- `application/json` or `multipart/form-data`

Multipart file field:
- `files`

Body example:

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
  "partnerExpectation": "Looking for a practicing and kind partner",
  "address": "Dhaka, Bangladesh",
  "coordinates": [90.4125, 23.8103]
}
```

Important field rules:
- `name`: 2 to 100 chars
- `dateOfBirth`: must be in the past
- `gender`: `MALE | FEMALE | OTHER`
- `religion`, `sect`, `caste`, `occupation`, `education`, `status`, `interests`, `personality`: must use constant keys from `/candidates/constants`
- `sect` requires `religion`
- selected `sect` must belong to selected `religion`
- `interests` and `personality` cannot contain duplicates
- `relationToUser` defaults to `SELF`

How it behaves:
- one account can belong to only one active candidate profile at a time
- profile creator is automatically added as primary linked user with owner access
- max allowed images per candidate profile: `6`

## Candidate Profile Update

### `PATCH /:candidateId`

Purpose:
- Update candidate profile fields
- Replace candidate images by removing existing links from `deletedImages` and adding newly uploaded images from `files`

Auth:
- Bearer token
- requester must be an active linked user of this candidate
- linked user with `VIEWER` access cannot update

Content type:
- `application/json` or `multipart/form-data`

Multipart file field:
- `files` (optional, multiple)

Body fields:
- Any candidate update fields from create API (all optional in patch)
- `deletedImages`: optional array of existing image links to remove
- `interests`: optional array of interest keys to append
- `deletedInterests`: optional array of interest keys to remove
- `personality`: optional array of personality keys to append
- `deletedPersonality`: optional array of personality keys to remove

JSON example (only profile info update):

```json
{
  "occupation": "SOFTWARE_ENGINEER",
  "bio": "Updated profile bio",
  "partnerExpectation": "Kind and family-oriented"
}
```

JSON example (incremental array update):

```json
{
  "interests": ["EXPLORING", "NON_FICTION"],
  "deletedInterests": ["ROAD_TRIPS"],
  "personality": ["GOAL_ORIENTED"],
  "deletedPersonality": ["EASY_GOING"]
}
```

JSON example (remove old image links only):

```json
{
  "deletedImages": [
    "https://res.cloudinary.com/demo/image/upload/v1/RistaPro/old-1.jpg",
    "https://res.cloudinary.com/demo/image/upload/v1/RistaPro/old-2.jpg"
  ]
}
```

Multipart example (remove old images + upload new images):

```text
Content-Type: multipart/form-data
files: <binary file 1>
files: <binary file 2>
data: {
  "occupation":"SOFTWARE_ENGINEER",
  "deletedImages":[
    "https://res.cloudinary.com/demo/image/upload/v1/RistaPro/old-1.jpg"
  ]
}
```

Image behavior:
- backend loads current `candidate.images`
- removes images found in `deletedImages`
- appends new uploaded `files` links
- stores the merged result in `candidate.images`
- max allowed images per candidate profile: `6`
- sends removed images to background queue delete processor (`deleteImageByBullMQ`)

Validation notes:
- patch payload can include one or many fields
- if no valid field change and no image change is provided, request is rejected
- `deletedImages` must be an array of non-empty unique strings
- `interests` and `personality` in patch are additive (append unique values)
- use `deletedInterests` and `deletedPersonality` for removing values

## Linked User APIs

These routes manage who can access a candidate profile.

Core rules:
- only linked `OWNER` can add, update, or remove linked users
- any active linked user can view linked users for that candidate profile
- one account can be actively linked to only one candidate profile at a time
- if email already exists, that account is linked
- if email does not exist, owner can create a new linked account in the same API call
- primary linked user must have `OWNER` access
- only one active `SELF` account is allowed per candidate profile

### `GET /my_linked_profiles`

Purpose:
- Get the active candidate profile the current account can access

Auth:
- Bearer token

Useful for:
- loading the current account's candidate access after login

### `GET /my_basic_profile`

Purpose:
- Get lightweight basic info for the current account's active candidate profile
- Useful for dashboard headers, app shell state, and preference screens that only need candidate identity

Auth:
- Bearer token

Response data shape:

```json
{
  "candidate": {
    "_id": "candidate id",
    "name": "Amina",
    "gender": "FEMALE",
    "dateOfBirth": "1998-05-11T00:00:00.000Z",
    "profileImage": "https://image-url.jpg",
    "images": ["https://image-url.jpg"],
    "isActive": "ACTIVE",
    "createdAt": "2026-04-22T00:00:00.000Z",
    "updatedAt": "2026-04-22T00:00:00.000Z"
  },
  "myAccess": {
    "_id": "linked user id",
    "accessRole": "OWNER",
    "relationshipToCandidate": "SELF",
    "status": "ACTIVE",
    "isPrimary": true,
    "linkedBy": "user id",
    "joinedAt": "2026-04-22T00:00:00.000Z"
  }
}
```

Notes:
- returns `null` when the logged-in user has no active candidate profile
- rejects the request if the account is linked to multiple active candidate profiles

### `GET /:candidateId/linked-users`

Purpose:
- List linked users for one candidate profile

Auth:
- Bearer token

Response includes:
- `management` summary
- `myAccess`
- `users`

### `POST /:candidateId/linked-users`

Purpose:
- Add linked user to candidate profile, with optional account creation

Auth:
- Bearer token
- requester must be an `OWNER`

Body example (create new account and link):

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

Body example (link existing account):

```json
{
  "name": "Candidate Father",
  "email": "father@example.com",
  "relationshipToCandidate": "FATHER",
  "accessRole": "EDITOR",
  "isPrimary": false
}
```

Field rules:
- `name`: required, 2 to 100 chars
- `email`: required, valid email
- `relationshipToCandidate`: required enum
- `password`: optional, but required when email does not already exist
- password rule: minimum 6 chars, must include at least 1 uppercase letter, 1 number, 1 special character

After creating a new linked account:
- linked user can login using `POST /auth/login` with the same `email` and `password`
- then call `GET /candidates/my_linked_profiles` to load accessible candidate profile

Allowed `relationshipToCandidate` values:
- `SELF`
- `FATHER`
- `MOTHER`
- `BROTHER`
- `SISTER`
- `GUARDIAN`
- `RELATIVE`
- `CONSULTANT`
- `OTHER`

Allowed `accessRole` values:
- `OWNER`
- `EDITOR`
- `VIEWER`

### `PATCH /:candidateId/linked-users/:linkedUserId`

Purpose:
- Update linked user relation or access role

Auth:
- Bearer token
- requester must be an `OWNER`

Body example:

```json
{
  "accessRole": "OWNER",
  "isPrimary": true
}
```

### `DELETE /:candidateId/linked-users/:linkedUserId`

Purpose:
- Remove linked user from candidate profile

Auth:
- Bearer token
- requester must be an `OWNER`

Safety rules:
- primary linked user cannot be removed directly
- last active owner cannot be removed

---

## Candidate Preference Module

Base path: `/api/v1/candidate-preferences`

This module stores the partner preferences used by the future swipe/feed system.

Security rules:
- all endpoints require `Authorization: Bearer <accessToken>`
- requester must be an active linked user of the candidate profile
- linked `VIEWER` users can read preferences only
- linked `OWNER` and `EDITOR` users can create, replace, or update preferences

Performance notes:
- `GET` uses a short Redis cache after authorization
- writes invalidate the preference cache
- preferences are automatically created with safe defaults when a candidate profile is created

Default behavior:
- for `MALE` candidates, `preferredGenders` defaults to `["FEMALE"]`
- for `FEMALE` candidates, `preferredGenders` defaults to `["MALE"]`
- for `OTHER` candidates, `preferredGenders` defaults to `["MALE", "FEMALE", "OTHER"]`
- `strictFilters.gender` defaults to `true`
- `strictFilters.age` defaults to `true` only when `ageMin` or `ageMax` exists
- other strict filters default to `false`

### `GET /:candidateId`

Purpose:
- Get partner preferences for a candidate profile
- If preferences do not exist yet, the backend creates default preferences and returns them

Auth:
- Bearer token
- requester must be an active linked user of this candidate

Example:

```http
GET /api/v1/candidate-preferences/665f1a2b3c4d5e6f78901234
Authorization: Bearer <accessToken>
```

### `PUT /:candidateId`

Purpose:
- Replace the full preference document for a candidate profile
- Missing optional array fields are saved as empty arrays
- Missing nullable number fields are removed

Auth:
- Bearer token
- requester must be linked `OWNER` or `EDITOR`

Body example:

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
  "relationship_statuses": ["SINGLE", "NEVER_MARRIED"],
  "have_children": ["NONE"],
  "move_abroad": ["YES", "MAYBE"],
  "occupations": ["SOFTWARE_ENGINEER", "DOCTOR"],
  "highest_educations": ["BACHELORS", "MASTERS"],
  "smoke_statuses": ["NEVER"],
  "drink_statuses": ["NEVER"],
  "interests": ["TRAVEL", "NON_FICTION"],
  "personality": ["HONEST", "LOYAL"],
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

### `PATCH /:candidateId`

Purpose:
- Partially update candidate preferences
- Only sent fields are changed
- Send `null` for nullable number fields to clear them

Auth:
- Bearer token
- requester must be linked `OWNER` or `EDITOR`

Body example:

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

Allowed fields:
- `preferredGenders`: `MALE | FEMALE | OTHER`
- `ageMin`, `ageMax`: number between `18` and `100`, or `null` in patch
- `heightMin`, `heightMax`: number between `1` and `300`, or `null` in patch
- `religions`, `sects`, `castes`
- `relationship_statuses`
- `have_children`
- `move_abroad`
- `occupations`
- `highest_educations`
- `smoke_statuses`
- `drink_statuses`
- `interests`
- `personality`
- `maxDistanceKm`: number between `1` and `10000`, or `null` in patch
- `strictFilters.gender`
- `strictFilters.age`
- `strictFilters.height`
- `strictFilters.religion`
- `strictFilters.caste`
- `strictFilters.location`

Validation notes:
- enum values must use constant keys from `GET /candidates/constants`
- arrays cannot contain duplicate values
- `ageMin` cannot be greater than `ageMax`
- `heightMin` cannot be greater than `heightMax`
- if both `religions` and `sects` are sent, every sect must belong to one of the selected religions
- patch request must contain at least one preference field

---

## Swipe Module

Base path: `/api/v1/swipes`

This module powers the Tinder-style candidate discovery feed.

Current phase:
- feed/recommendation API only
- like, super-like, and pass actions are planned for the next phase

Security rules:
- all endpoints require `Authorization: Bearer <accessToken>`
- requester must be an active linked user of the `candidateId`
- `OWNER`, `EDITOR`, and `VIEWER` users can view the feed
- mutation permissions are not used yet because Phase 2 does not create swipe actions

### `GET /feed`

Purpose:
- Return a ranked candidate stack for one candidate profile
- Apply candidate preferences from `/candidate-preferences/:candidateId`
- Exclude own profile, already acted profiles, matched profiles, and reported profiles
- Filter out candidates whose owner account is not verified

Query params:
- `candidateId`: required candidate profile id
- `limit`: optional, default `20`, max `50`
- `cursor`: optional cursor returned from the previous response

Example:

```http
GET /api/v1/swipes/feed?candidateId=665f1a2b3c4d5e6f78901234&limit=20
Authorization: Bearer <accessToken>
```

Response data shape:

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

Recommendation behavior:
- strict filters remove candidates from the query
- soft preferences add match score
- if strict filters return too few candidates, the API relaxes optional filters and returns `relaxed: true`
- first page builds a short Redis feed session so later cursor pages are fast

Dedicated module documentation:
- `src/app/modules/swipe/API.md`

---

## Example Headers

Bearer token request:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Refresh request:

```http
Cookie: refreshToken=<refreshToken>
Authorization: Bearer <currentAccessToken>
```

OTP password reset request:

```http
token: <otp-verification-token>
Content-Type: application/json
```

## Recommended Frontend Integration Order

1. Login user through Google or credentials
2. Load `/plans` if pricing UI is needed
3. Load `/candidates/constants` before candidate forms
4. Create candidate profile
5. Load or update `/candidate-preferences/:candidateId`
6. Load `/swipes/feed?candidateId=<candidateId>` for the discovery stack
7. Load `/candidates/my_linked_profiles` after login to fetch the current account's candidate access
8. Use linked-user APIs to add father, mother, consultant, or other guardians

## Maintenance Note

If you add a new mounted module or change a route, update this README in the same PR so frontend and backend stay in sync.
