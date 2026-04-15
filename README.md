# RistaPro API Guide

This README documents the API modules that are currently mounted under `/api/v1`.

Active modules today:
- `auth`
- `users`
- `plans`
- `candidates`

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
4. If needed, add family members with linked-user APIs

### 4. Guardian-managed candidate profile

1. Guardian logs in
2. Create candidate using `relationToUser`
3. Add other linked users with `POST /candidates/:candidateId/linked-users` (link existing account or create new account with `name + email + password`)
4. Candidate owner can load the managed candidate from `GET /candidates/my_linked_profiles`

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
- `religion`, `sect`, `caste`, `education`, `status`, `interests`, `personality`: must use constant keys from `/candidates/constants`
- `sect` requires `religion`
- selected `sect` must belong to selected `religion`
- `interests` and `personality` cannot contain duplicates
- `relationToUser` defaults to `SELF`

How it behaves:
- one account can belong to only one active candidate profile at a time
- profile creator is automatically added as primary linked user with owner access

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
5. Load `/candidates/my_linked_profiles` after login to fetch the current account's candidate access
6. Use linked-user APIs to add father, mother, consultant, or other guardians

## Maintenance Note

If you add a new mounted module or change a route, update this README in the same PR so frontend and backend stay in sync.

