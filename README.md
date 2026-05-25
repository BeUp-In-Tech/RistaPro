# RishtaPro API Guide

This README documents the API modules that are currently mounted under `/api/v1`.

Active modules today:

- `auth`
- `users`
- `plans`
- `candidates`
- `candidate-preferences`
- `swipes`
- `likes`
- `visitors`
- `matches`
- `conversations`
- `messages`
- `calls`
- `notifications`
- `rishta-progress`
- `documents`
- `meeting-schedules`
- `consultant`

Other route files may exist in the codebase, but they are not publicly available until they are mounted in the main router.

## Table of Contents

- [Base URL](#base-url)
- [Auth Rules](#auth-rules)
- [Common Response Shape](#common-response-shape)
- [Multipart Request Note](#multipart-request-note)
- [Quick Start Flows](#quick-start-flows)
- [Product Feature Overview](#product-feature-overview)
- [Auth Module](#auth-module)
- [User Module](#user-module)
- [Plan Module](#plan-module)
- [Candidate Module](#candidate-module)
- [Candidate Preference Module](#candidate-preference-module)
- [Swipe Module](#swipe-module)
- [Like Module](#like-module)
- [Profile Visitor Module](#profile-visitor-module)
- [Match Module](#match-module)
- [Conversation Module](#conversation-module)
- [Message Module](#message-module)
- [Call Module](#call-module)
- [Notification Module](#notification-module)
- [Rishta Progress Module](#rishta-progress-module)
- [Document Module](#document-module)
- [Consultant Module](#consultant-module)
- [Meeting Schedule Module](#meeting-schedule-module)
- [Postman Testing Guide: Swipe To Match](#postman-testing-guide-swipe-to-match)
- [Postman Testing Guide: Chat](#postman-testing-guide-chat)
- [Postman Testing Guide: Rishta Progress And Marriage Approval](#postman-testing-guide-rishta-progress-and-marriage-approval)
- [Postman Testing Guide: Consultant Module](#postman-testing-guide-consultant-module)
- [Postman Testing Guide: Meeting Schedule](#postman-testing-guide-meeting-schedule)
- [Maintenance Note](#maintenance-note)

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

### Swipe/Match APIs Added For Testing

These are the currently mounted APIs for the swipe-match flow:

- `GET /api/v1/swipes/feed`
- `POST /api/v1/swipes/action`
- `GET /api/v1/likes/received`
- `GET /api/v1/likes/sent`
- `POST /api/v1/visitors/track`
- `GET /api/v1/visitors`
- `GET /api/v1/matches`
- `GET /api/v1/matches/:matchId`
- `PATCH /api/v1/matches/:matchId/unmatched`
- `GET /api/v1/conversations`
- `POST /api/v1/conversations/matches/:matchId/start`
- `POST /api/v1/conversations/message_requests`
- `POST /api/v1/messages`
- `POST /api/v1/calls/start`
- `POST /api/v1/calls/:callId/accept`
- `POST /api/v1/calls/:callId/reject`
- `POST /api/v1/calls/:callId/end`
- `POST /api/v1/calls/:callId/token`
- `POST /api/v1/calls/:callId/participants/invite`
- `POST /api/v1/calls/:callId/participants/respond`
- `GET /api/v1/calls/:callId`
- `GET /api/v1/rishta-progress`
- `POST /api/v1/rishta-progress/marriage-requests`
- `GET /api/v1/rishta-progress/marriage-requests`
- `GET /api/v1/notifications`
- `POST /api/v1/meeting-schedules`
- `POST /api/v1/meeting-schedules/:meetingId/join`
- `GET /api/v1/consultant/available`
- `POST /api/v1/consultant/cases/start`
- `POST /api/v1/consultant/cases`
- `GET /api/v1/consultant/cases`
- `POST /api/v1/consultant/cases/:caseId/messages`
- `POST /api/v1/consultant/cases/:caseId/candidate-invites`
- `POST /api/v1/consultant/cases/:caseId/guest-invites`
- `POST /api/v1/consultant/guest-invites/:token/meetings/:meetingId/join`
- `POST /api/v1/consultant/calls/start`
- `POST /api/v1/consultant/marriage-records`

Notes:

- mutual positive swipes automatically create one `Match`
- a match also creates or returns one `Conversation`
- the conversation id is returned as `match.conversation`
- chat message, message-request, and guardian-request routes are mounted
- rishta progress updates automatically from match, chat, parent involvement, and marriage approval events
- marriage confirmation requests create DB notifications and Firebase push jobs
- consultant cases support candidate-selected consultants, case chat, candidate invites, guest links, guest video access, and manual marriage records
- realtime chat events are emitted through Socket.IO

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
6. Like, super-like, or pass cards with `POST /swipes/action`
7. Track profile detail opens with `POST /visitors/track`
8. Review profile visitors with `GET /visitors?candidateId=<candidateId>`
9. Review sent likes with `GET /likes/sent?candidateId=<candidateId>`
10. Gold/platinum candidates can review received likes with `GET /likes/received?candidateId=<candidateId>`
11. If `POST /swipes/action` returns `matched: true`, use `match.conversation` for the chat thread
12. Load active matches with `GET /matches?candidateId=<candidateId>`
13. Open/list chat with `GET /conversations?candidateId=<candidateId>`
14. Send chat messages with `POST /messages`
15. Start audio/video calls with `POST /calls/start`
16. If needed, add family members with linked-user APIs, then request chat inclusion with guardian request APIs
17. Invite already-involved linked users into an active call with `POST /calls/:callId/participants/invite`

### 4. Guardian-managed candidate profile

1. Guardian logs in
2. Create candidate using `relationToUser`
3. Add other linked users with `POST /candidates/:candidateId/linked_users` (link existing account or create new account with `name + email + password`)
4. Candidate owner can load basic profile info from `GET /candidates/my_basic_profile`
5. Candidate owner can load the full managed candidate access from `GET /candidates/my_linked_profiles`

---

## Product Feature Overview

- **Create Account & Candidate Profile**: Users can create their account and then create a candidate profile for matchmaking.
- **Swipe**: Candidates can explore profiles, like, super-like, or pass. Mutual positive actions create a match.
- **Chat System**: Candidates can chat by text, with audio/video call support handled by the call module.
- **Rishta Progress**: The system tracks a pair through `MATCHES`, `START_CHAT`, `PARENT_INVOLVES`, and `SHAADI`.
- **Marriage Approval**: Candidate owners and consultants create marriage confirmation requests; Shaadi is completed only after the required candidate-side approval, while admin can confirm directly.
- **Consultant Support**: Platinum candidates can work with consultants through scheduled meetings, consultant-managed cases, case chat, Agora calls, guest invite links, and manual marriage records.
- **Parental Control**: Parents or guardians can manage a candidate profile through linked-user access and can join a chat after the opposite side accepts the guardian request.
- **Documents verification**:
  - Face verification
  - Educational documents verification
  - Parent verification
  - Id verification
- **Privacy**: User data and documents are stored securely and reviewed through the verification workflow.
 
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

### `POST /google/auth`

Purpose:

- Authenticate with a Google ID token from Apple/iOS devices that cannot use the browser OAuth redirect flow

Auth:

- Public

Body:

```json
{
  "idToken": "google-id-token-from-firebase-or-google-sign-in-sdk"
}
```

Notes:

- verifies the Google ID token using Firebase Admin
- creates the user automatically if not found
- returns `accessToken` in the response body and sets the refresh token cookie
- use this route instead of `GET /google` when the client is a native iOS app

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

- Refresh cookie must exist

Notes:

- route reads refresh token from cookie
- rotates the refresh token cookie
- returns the new access token in response data

Example:

```http
GET /api/v1/auth/get_new_access_token
Cookie: refreshToken=<refreshToken>
```

Response data shape:

```json
{
  "accessToken": "new access token"
}
```

---

## User Module

Base path: `/api/v1/users`

## Authenticated User Endpoints

### `GET /me`

Purpose:

- Get logged-in user profile plus app context for frontend gating

Auth:

- Bearer token

Response includes:

- top-level user fields such as `_id`, `full_name`, `email`, `picture`, `plan`, `isVerified`, `isActive`, and `role`
- `candidateLink`: whether this account is linked to a candidate profile, which candidate, and the user's access role
- `permissions`: frontend-friendly booleans for swipe, messaging, calls, full profile details, and profile boost

Example response data shape:

```json
{
  "_id": "user id",
  "full_name": "Nayem Ahmed",
  "email": "nayemalways.sm@gmail.com",
  "plan": "free",
  "candidateLink": {
    "isLinked": true,
    "source": "LINKED_USER",
    "candidateId": "candidate id",
    "myAccess": {
      "accessRole": "OWNER",
      "relationshipToCandidate": "SELF",
      "status": "ACTIVE",
      "isPrimary": true
    }
  },
  "permissions": {
    "canViewSwipeFeed": true,
    "canPerformSwipeAction": true,
    "canUseNormalLike": true,
    "canUseSuperLike": false,
    "canSeeWhoLiked": false,
    "canMessage": false,
    "canAudioCall": false,
    "canVideoCall": false,
    "canViewFullProfile": false,
    "canUseConsultant": false,
    "canRequestConsultantMeeting": false,
    "canUseConsultantChat": false,
    "canUseConsultantVideoCall": false,
    "profileBoost": false
  }
}
```

Frontend notes:

- Use `permissions` for broad UI gating, such as hiding full-profile sections or disabling super-like buttons for free users.
- Use `canUseConsultant`, `canRequestConsultantMeeting`, `canUseConsultantChat`, and `canUseConsultantVideoCall` to gate Platinum consultant UI.
- The swipe action API remains the source of truth for quota and returns the latest remaining like counts after each action.
- `GET /users/me` intentionally does not expose raw quota counters or the full plan document.
- Plan values come from the active plan document in MongoDB. Changing `plan.constant.ts` updates future create/update payloads, but existing plan documents must be updated through the plan update API or a migration.

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
- candidate profile updates
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
  "address": "Dhaka, Bangladesh",
  "coordinates": [90.4125, 23.8103]
}
```

Important field rules:

- `name`: 2 to 100 chars
- `dateOfBirth`: must be in the past
- `gender`: `MALE | FEMALE | OTHER`
- `religion`, `sect`, `caste`, `occupation`, `highest_education`, `relationship_status`, `have_children`, `move_abroad`, `smoke_status`, `drink_status`, `interests`, `personality`: must use constant keys from `/candidates/constants`
- `sect` requires `religion`
- selected `sect` must belong to selected `religion`
- `interests` and `personality` cannot contain duplicates
- `relationToUser` defaults to `SELF`
- request body is strict; unknown fields are rejected

How it behaves:

- one account can belong to only one active candidate profile at a time
- profile creator is automatically added as primary linked user with owner access
- default candidate preferences are created automatically
- max allowed images per candidate profile: `6`

Response data includes the candidate profile plus:

- `labels`: display labels generated from constant keys
- `management`: linked-user management summary
- `myAccess`: the creator's active linked-user access

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
  "bio": "Updated profile bio"
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
- duplicate image links are normalized away
- stores the merged result in `candidate.images`
- max allowed images per candidate profile: `6`
- sends removed images to background queue delete processor (`deleteImageByBullMQ`)

Validation notes:

- patch payload can include one or many fields
- if no valid field change and no image change is provided, request is rejected
- `deletedImages` must be an array of non-empty unique strings
- `interests` and `personality` in patch are additive (append unique values)
- use `deletedInterests` and `deletedPersonality` for removing values
- if both add and delete arrays contain the same key, the final stored value includes it because additions are applied after deletions

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

### `GET /:targetCandidateId/full_profile`

Purpose:

- Get the full profile details of another candidate
- Used when a linked user opens a candidate's detail page from the feed, likes, or visitors list

Auth:

- Bearer token (`USER`)
- requester must be an active linked user of any candidate profile

Example:

```http
GET /api/v1/candidates/665f1a2b3c4d5e6f78905678/full_profile
Authorization: Bearer <accessToken>
```

Notes:

- returns the full candidate profile including all fields, labels, and images
- only returns profiles whose owner account is active and verified

### `GET /:candidateId/linked_users`

Purpose:

- List linked users for one candidate profile

Auth:

- Bearer token

Response includes:

- `management` summary
- `myAccess`
- `users`

### `POST /:candidateId/linked_users`

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

### `PATCH /:candidateId/linked_users/:linkedUserId`

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

### `DELETE /:candidateId/linked_users/:linkedUserId`

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

This module stores the partner preferences used by the swipe/feed system.

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

Security rules:

- all endpoints require `Authorization: Bearer <accessToken>`
- requester must be an active linked user of the `candidateId`
- `OWNER`, `EDITOR`, and `VIEWER` users can view the feed
- `OWNER` and `EDITOR` users can like, super-like, or pass
- `VIEWER` users can view only

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

Recommendation behavior:

- strict filters remove candidates from the query
- soft preferences add match score
- if strict filters return too few candidates, the API relaxes optional filters and returns `relaxed: true`
- first page builds a short Redis feed session so later cursor pages are fast

### `GET /nearby-matches`

Purpose:

- Return preference-matching candidates near the requester location
- Uses saved candidate coordinates
- Return the requester location string in `meta.currentLocation`

Query params:

- `radiusKm`: optional; defaults to preference `maxDistanceKm`, otherwise `25`
- `page`: optional, default `1`
- `limit`: optional, default `20`, max `50`

Example:

```http
GET /api/v1/swipes/nearby-matches?radiusKm=25
Authorization: Bearer <accessToken>
```

Response:

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
      "images": [],
      "labels": {},
      "livesIn": "Dhaka",
      "distanceKm": 8.4,
      "matchScore": 72,
      "personality": [],
      "religion": "ISLAM"
    }
  ]
}
```

Geocoding behavior:

- backend reverse-geocodes requester coordinates with OpenStreetMap Nominatim
- geocoding failure does not fail the API; `currentLocation` becomes `null`
- current coordinates are never saved to the candidate profile from this API

### `POST /action`

Purpose:

- Save one Tinder-style swipe action for a candidate profile
- Hide the target profile from future feed results
- Create a match when both candidates have a positive action toward each other

Auth:

- Bearer token
- requester must be an active linked `OWNER` or `EDITOR` of `candidateId`

Body:

```json
{
  "candidateId": "665f1a2b3c4d5e6f78901234",
  "targetCandidateId": "665f1a2b3c4d5e6f78905678",
  "type": "LIKE",
  "source": "FEED"
}
```

Allowed values:

- `type`: `LIKE`, `SUPER_LIKE`, `PASS`
- `source`: optional, `FEED`, `LIKES_ME`, or `PROFILE`; defaults to `FEED`

Behavior:

- `PASS` is free and does not create a match
- `LIKE` consumes one daily like
- `SUPER_LIKE` consumes one super-like
- mutual `LIKE`/`SUPER_LIKE` creates or returns an active match and one match conversation
- duplicate same-action retries are safe
- changing a previous action is rejected
- active matches and reports block new swipe actions

Response data shape:

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

Dedicated module documentation:

- `src/app/modules/swipe/API.md`
- `src/app/modules/match/API.md`
- `src/app/modules/conversation/API.md`
- `src/app/modules/message/API.md`

---

## Like Module

Base path: `/api/v1/likes`

This module exposes read-only like history for candidate profiles.

Security rules:

- all endpoints require `Authorization: Bearer <accessToken>`
- requester must be an active linked user of the `candidateId`
- `GET /received` requires the candidate plan to allow `canSeeWhoLiked`
- current default plans unlock received likes for `gold` and `platinum`
- only `LIKE` and `SUPER_LIKE` records are returned
- `PASS` is never returned by these APIs
- unavailable candidate profiles are hidden from results

Shared query params:

- `candidateId`: required candidate profile id
- `type`: optional, `LIKE` or `SUPER_LIKE`
- `page`: optional, default `1`
- `limit`: optional, default `20`, max `50`
- `sort`: optional, default puts super-likes first and newest first

### `GET /received`

Purpose:

- List candidates who liked or super-liked this candidate
- Support filtering by normal likes or super-likes
- Keep this API paid through the plan `canSeeWhoLiked` flag

Example:

```http
GET /api/v1/likes/received?candidateId=665f1a2b3c4d5e6f78901234&type=SUPER_LIKE&page=1&limit=20
Authorization: Bearer <accessToken>
```

Behavior:

- queries positive likes where `likedProfile` is the candidate
- returns `403` if the candidate plan cannot see who liked them
- omitting `type` returns both `LIKE` and `SUPER_LIKE`
- `type=PASS` fails validation

### `GET /sent`

Purpose:

- List candidates this candidate liked or super-liked
- Support filtering by normal likes or super-likes

Example:

```http
GET /api/v1/likes/sent?candidateId=665f1a2b3c4d5e6f78901234&type=LIKE&page=1&limit=20
Authorization: Bearer <accessToken>
```

Behavior:

- queries positive likes where `likedBy` is the candidate
- omitting `type` returns both `LIKE` and `SUPER_LIKE`
- `type=PASS` fails validation

Response shape:

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Received likes retrieved successfully",
  "data": [
    {
      "_id": "like id",
      "type": "SUPER_LIKE",
      "source": "FEED",
      "createdAt": "2026-05-16T00:00:00.000Z",
      "candidate": {
        "_id": "candidate id",
        "name": "Amina",
        "age": 24,
        "gender": "FEMALE",
        "images": ["https://image-url.jpg"],
        "religion": "ISLAM",
        "livesIn": "Dhaka"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 12,
    "totalPage": 1
  }
}
```

---

## Profile Visitor Module

Base path: `/api/v1/visitors`

This module records profile detail visits and lists who visited a candidate profile.

Security rules:

- all endpoints require `Authorization: Bearer <accessToken>`
- requester must be an active linked user of the acting/listed `candidateId`
- visitor rows are unique per `visitedBy -> visitedProfile` pair
- repeat visits update `lastVisitedAt` and increment `visitCount`

### `POST /track`

Purpose:

- Track that one candidate opened another candidate's profile detail

Auth:

- `USER`

Body:

```json
{
  "candidateId": "viewer candidate id",
  "visitedProfileId": "visited candidate id"
}
```

Example:

```http
POST /api/v1/visitors/track
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Behavior:

- self-visits are ignored and return `tracked: false`
- response is non-blocking; successful requests return after access validation and queue the Mongo upsert in-process
- frontend should call this only after opening a real profile detail page from a valid feed/profile source
- successful repeat visits update the same row, not a duplicate row

Response data shape:

```json
{
  "tracked": true,
  "queued": true
}
```

Self-visit response data:

```json
{
  "tracked": false,
  "reason": "SELF_VISIT"
}
```

### `GET /`

Purpose:

- List candidates who visited this candidate profile

Auth:

- `USER`

Query:

- `candidateId`: required candidate profile id
- `page`: optional, default `1`
- `limit`: optional, default `20`, max `50`

Example:

```http
GET /api/v1/visitors?candidateId=665f1a2b3c4d5e6f78901234&page=1&limit=20
Authorization: Bearer <accessToken>
```

Response shape:

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Profile visitors retrieved successfully",
  "data": [
    {
      "_id": "visitor candidate id",
      "name": "Amna Khalid",
      "age": 21,
      "gender": "FEMALE",
      "badge": true,
      "images": ["https://image-url.jpg"],
      "occupation": "STUDENT",
      "religion": "ISLAM",
      "livesIn": "Lahore",
      "labels": {
        "occupation": "Student",
        "religion": "Islam"
      },
      "lastVisitedAt": "2026-05-21T10:00:00.000Z",
      "visitCount": 3
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 12,
    "totalPage": 1
  }
}
```

Notes:

- `images` contains at most 1 image for the compact visitor card.
- list sorting is fixed to newest `lastVisitedAt` first.

---

## Match Module

Base path: `/api/v1/matches`

This module exposes candidate-to-candidate matches created by mutual swipe actions.

Security rules:

- all endpoints require `Authorization: Bearer <accessToken>`
- requester must be an active linked user of at least one candidate in the match
- `OWNER`, `EDITOR`, and `VIEWER` users can read matches
- only `OWNER` and `EDITOR` users can unmatch

Lifecycle:

- a mutual `LIKE` or `SUPER_LIKE` creates one `Match`
- the same mutual action also creates or returns one `Conversation`
- the conversation id is stored on `match.conversation`
- unmatch marks the match as `UNMATCHED` and archives the open conversation
- old match/conversation data is kept for audit

### `GET /`

Purpose:

- List active matches for one candidate profile

Query params:

- `candidateId`: required candidate profile id

Example:

```http
GET /api/v1/matches?candidateId=665f1a2b3c4d5e6f78901234
Authorization: Bearer <accessToken>
```

Response data shape:

```json
[
  {
    "_id": "match id",
    "pairKey": "candidateA_candidateB",
    "status": "ACTIVE",
    "conversation": "conversation id",
    "matchedBy": "candidate id",
    "candidates": [
      {
        "_id": "candidate id",
        "name": "Amina",
        "age": 24,
        "gender": "FEMALE",
        "images": ["https://image-url.jpg"],
        "livesIn": "Dhaka",
        "religion": "ISLAM"
      }
    ],
    "createdAt": "2026-05-11T00:00:00.000Z",
    "updatedAt": "2026-05-11T00:00:00.000Z"
  }
]
```

### `GET /:matchId`

Purpose:

- Get one match detail

Query params:

- `candidateId`: optional but recommended; must be one of the matched candidates when provided

Example:

```http
GET /api/v1/matches/665f1a2b3c4d5e6f78909999?candidateId=665f1a2b3c4d5e6f78901234
Authorization: Bearer <accessToken>
```

Usage:

- use this after receiving a `match._id` from `/swipes/action`
- use `data.conversation` as the conversation id for future chat APIs

### `PATCH /:matchId/unmatched`

Purpose:

- End an active match without deleting history

Query params:

- `candidateId`: optional but recommended; must be one of the matched candidates when provided

Example:

```http
PATCH /api/v1/matches/665f1a2b3c4d5e6f78909999/unmatched?candidateId=665f1a2b3c4d5e6f78901234
Authorization: Bearer <accessToken>
```

Behavior:

- sets match status to `UNMATCHED`
- archives the linked open conversation
- `VIEWER` linked users cannot unmatch

---

## Conversation Module

Base path: `/api/v1/conversations`

This module manages chat threads, message requests, and guardian/parent include requests. Realtime delivery uses Socket.IO events after the database write succeeds.

Security rules:

- All endpoints require `Authorization: Bearer <accessToken>`.
- The requester must be an active linked user of the provided `candidateId`.
- `OWNER` and `EDITOR` can start/respond/send request actions.
- `VIEWER` can read allowed conversations but cannot send messages or respond to requests.
- Family, relative, guardian, and consultant linked users can read/send only after the opponent accepts an include request for that exact linked user, unless that linked user is the candidate's primary manager. `OTHER` linked users cannot be included.
- Free plan users cannot create message requests or send chat messages because `canMessage` is false.

Socket.IO events:

- client connection URL is the same backend host.
- client emits `join-user` with `userId`
- client emits `join-conversation` with `conversationId`
- client emits `leave-conversation` with `conversationId`
- server emits `online_users`, `conversation:started`, `message-request:new`, `message-request:accepted`, `message-request:rejected`, `message:new`, `conversation:read`, `guardian-request:new`, `guardian-request:accepted`, `guardian-request:rejected`, `guardian:included`.
- typing indicators use `typing:start` and `typing:stop`

### `POST /matches/:matchId/start`

Purpose:

- Returns or creates the open conversation for an active match.

Query:

- `candidateId`: optional but recommended

Example:

```http
POST /api/v1/conversations/matches/665f1a2b3c4d5e6f78909999/start?candidateId=665f1a2b3c4d5e6f78901234
Authorization: Bearer <accessToken>
```

### `GET /`

Purpose:

- List conversations for a candidate with pagination and opponent profile info.

Query:

- `candidateId`: required
- `status`: optional, `OPEN`, `ARCHIVED`, or `BLOCKED` (default `OPEN`)
- `source`: optional, `MATCH` or `MESSAGE_REQUEST`
- `page`: optional, default `1`
- `limit`: optional, default `10`, max `100`

Example:

```http
GET /api/v1/conversations?candidateId=665f1a2b3c4d5e6f78901234&status=OPEN&source=MATCH&page=1&limit=10
Authorization: Bearer <accessToken>
```

Response data shape:

```json
{
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPage": 1
  },
  "data": [
    {
      "_id": "conversation id",
      "pairKey": "candidateA_candidateB",
      "status": "OPEN",
      "source": "MATCH",
      "parentInvolvement": false,
      "lastMessage": {
        "_id": "message id",
        "message": "Assalamu alaikum",
        "type": "TEXT",
        "sender": "candidate id",
        "sentBy": "user id",
        "seenBy": [],
        "createdAt": "2026-05-21T10:00:00.000Z"
      },
      "unreadCount": 2,
      "opponent": {
        "_id": "opponent candidate id",
        "name": "Amina",
        "image": "https://image-url.jpg",
        "images": null
      },
      "createdAt": "2026-05-11T00:00:00.000Z",
      "updatedAt": "2026-05-21T10:00:00.000Z"
    }
  ]
}
```

Notes:

- `opponent` contains the other candidate's `_id`, `name`, and `image` (first image or `null`).
- `unreadCount` is the unread message count for the requesting user.
- `images` is omitted from the opponent object; use `image` for the profile picture.

### `GET /:conversationId/messages`

Purpose:

- Load message history for a conversation.

Query:

- `candidateId`: required
- `limit`: optional, default 50
- `before`: optional ISO date for pagination

Example:

```http
GET /api/v1/conversations/665f1a2b3c4d5e6f78908888/messages?candidateId=665f1a2b3c4d5e6f78901234&limit=50
Authorization: Bearer <accessToken>
```

### `PATCH /:conversationId/read`

Purpose:

- Mark messages as seen in a conversation.

Body:

```json
{
  "candidateId": "665f1a2b3c4d5e6f78901234"
}
```

### `POST /message_requests`

Purpose:

- Send a request to chat without a match.

Body:

```json
{
  "requesterCandidateId": "candidateA",
  "targetCandidateId": "candidateB",
  "firstMessage": "Assalamu alaikum, can we start a conversation?"
}
```

Behavior:

- saves a pending request
- emits `message-request:new`
- rejected requests can be sent again later
- a second pending request for the same direction is rejected

### `GET /message_requests`

Purpose:

- List message requests.

Query:

- `candidateId`: required
- `type`: optional, `incoming`, `outgoing`, or `all` (default `incoming`)
- `status`: optional, `PENDING`, `ACCEPTED`, `REJECTED`, or `CANCELLED`

### `PATCH /message-requests/:requestId/accept`

Purpose:

- Accept a message request.

Body:

```json
{
  "candidateId": "targetCandidateId"
}
```

Behavior:

- accepts the request
- creates or opens the conversation
- saves the request `firstMessage` as the first chat message
- emits `message-request:accepted`, `conversation:started`, and `message:new`

### `PATCH /message-requests/:requestId/reject`

Purpose:

- Reject a message request.

Body:

```json
{
  "candidateId": "targetCandidateId"
}
```

### `POST /:conversationId/guardian-requests`

Purpose:

- Request to include a parent/guardian in the chat.

Body:

```json
{
  "candidateId": "candidateA",
  "linkedUserId": "relativeLinkedUserId",
  "message": "I want to include my family member in this chat."
}
```

Behavior:

- the linked user must belong to `candidateId`
- relationship must be `FATHER`, `MOTHER`, `BROTHER`, `SISTER`, `GUARDIAN`, `RELATIVE`, or `CONSULTANT`
- saves a pending DB request
- emits `guardian-request:new` to the opponent side in realtime

### `GET /guardian-requests`

Purpose:

- List guardian include requests.

Query:

- `candidateId`: required
- `type`: optional, `incoming`, `outgoing`, or `all` (default `incoming`)
- `status`: optional, `PENDING`, `ACCEPTED`, `REJECTED`, or `CANCELLED`

### `PATCH /guardian-requests/:requestId/accept`

Purpose:

- Accept a guardian include request.

Body:

```json
{
  "candidateId": "opponentCandidateId"
}
```

Behavior:

- marks the request as accepted
- adds that exact guardian linked user to `conversation.guardianParticipants`
- emits `guardian-request:accepted` and `guardian:included`
- the approved guardian can now list/read/send in that conversation

### `PATCH /guardian-requests/:requestId/reject`

Purpose:

- Reject a guardian include request.

Body:

```json
{
  "candidateId": "opponentCandidateId"
}
```

---

## Message Module

Base path: `/api/v1/messages`

### `POST /`

Purpose:

- Send one text message into an open conversation
- Update last message and unread counts
- Emit `message:new` through Socket.IO

Body:

```json
{
  "conversationId": "conversation id",
  "candidateId": "sender candidate id",
  "message": "Assalamu alaikum",
  "replyTo": "optional message id"
}
```

Detailed docs: `src/app/modules/message/API.md`

---

## Call Module

Base path: `/api/v1/calls`

The call module is the backend control plane for Agora RTC. The backend does not carry audio/video media; Agora carries media streams, while this API validates permissions, creates call state, generates RTC tokens, emits Socket.IO events, and sends push notifications.

Required package:

```bash
yarn add agora-access-token
```

Environment:

```text
AGORA_APP_ID=<Agora app id>
AGORA_APP_CERTIFICATE=<Agora app certificate>
AGORA_TOKEN_TTL_SECONDS=3600
CALL_RING_TIMEOUT_SECONDS=60
CALL_MAX_PARTICIPANTS=6
```

Security rules:

- all endpoints require `Authorization: Bearer <accessToken>`
- only the active `SELF` owner linked user can start, accept, reject, or invite for a candidate side
- audio calls require the caller candidate plan to allow `canAudioCall`
- video calls require the caller candidate plan to allow `canVideoCall`
- linked users can join calls only after they are already active in `conversation.guardianParticipants`
- backend returns Agora `appId`, `channelName`, `token`, and numeric `uid`; clients join Agora with those values

Socket.IO events:

- `call:ringing`
- `call:accepted`
- `call:rejected`
- `call:ended`
- `call:participant-invited`
- `call:participant-joined`
- `call:participant-rejected`

### `POST /start`

Purpose:

- Start a 1-to-1 audio/video call inside an existing open conversation
- Return the caller's Agora token immediately
- Ring the receiver candidate's `SELF` owner through Socket.IO and push notification

Body:

```json
{
  "conversationId": "conversation id",
  "candidateId": "caller candidate id",
  "type": "VIDEO"
}
```

Example:

```http
POST /api/v1/calls/start
Authorization: Bearer <callerToken>
Content-Type: application/json
```

Response data shape:

```json
{
  "call": {
    "_id": "call id",
    "conversation": "conversation id",
    "channelName": "call_665f1a2b3c4d5e6f78901234",
    "type": "VIDEO",
    "status": "INITIATED",
    "callerCandidate": "candidate A",
    "receiverCandidate": "candidate B",
    "ringExpiresAt": "2026-05-21T10:01:00.000Z",
    "participants": []
  },
  "agora": {
    "appId": "Agora app id",
    "channelName": "call_665f1a2b3c4d5e6f78901234",
    "token": "Agora RTC token",
    "uid": 123456,
    "expiresAt": "2026-05-21T11:00:00.000Z"
  }
}
```

### `POST /:callId/accept`

Purpose:

- Receiver candidate's `SELF` owner accepts the ringing call
- Returns the receiver's Agora token

Body:

```json
{
  "candidateId": "receiver candidate id"
}
```

Behavior:

- call must still be `INITIATED`
- request must happen before `ringExpiresAt`
- call becomes `ACTIVE`
- emits `call:accepted`

### `POST /:callId/reject`

Purpose:

- Receiver candidate's `SELF` owner rejects the ringing call

Body:

```json
{
  "candidateId": "receiver candidate id"
}
```

Behavior:

- call becomes `REJECTED`
- emits `call:rejected`

### `POST /:callId/end`

Purpose:

- End an active or ringing call

Body:

```json
{
  "candidateId": "joined candidate id"
}
```

Behavior:

- active participant can end the call
- call becomes `COMPLETED`
- emits `call:ended`

### `POST /:callId/token`

Purpose:

- Renew an Agora token for a joined active call participant

Body:

```json
{
  "candidateId": "candidate id"
}
```

Response data shape:

```json
{
  "appId": "Agora app id",
  "channelName": "call_665f1a2b3c4d5e6f78901234",
  "token": "Agora RTC token",
  "uid": 123456,
  "expiresAt": "2026-05-21T11:00:00.000Z"
}
```

### `POST /:callId/participants/invite`

Purpose:

- Invite an already-involved linked user to join an active call

Body:

```json
{
  "candidateId": "candidate id",
  "linkedUserId": "linked user id"
}
```

Rules:

- inviter must be the active `SELF` owner of `candidateId`
- inviter must already be joined in the call
- `linkedUserId` must already be active in the conversation's `guardianParticipants`
- max participants defaults to `6`
- emits `call:participant-invited`

### `POST /:callId/participants/respond`

Purpose:

- Invited linked user accepts or rejects a call invitation

Body:

```json
{
  "candidateId": "candidate id",
  "linkedUserId": "linked user id",
  "action": "ACCEPT"
}
```

Behavior:

- `ACCEPT` marks the linked user as joined and returns an Agora token
- `REJECT` marks the linked user invitation as rejected
- emits `call:participant-joined` or `call:participant-rejected`

### `GET /:callId`

Purpose:

- Read current call state

Auth:

- any call participant user

Client integration flow:

1. Caller opens chat and calls `POST /calls/start`.
2. Caller joins Agora using `data.agora.appId`, `channelName`, `token`, and numeric `uid`.
3. Receiver listens for `call:ringing`, then calls `POST /calls/:callId/accept`.
4. Receiver joins Agora with the returned token.
5. Either side calls `POST /calls/:callId/end`.
6. For long calls, joined participants refresh with `POST /calls/:callId/token` before token expiry.
7. To include family, first use the existing conversation guardian request flow. After the linked user is active in the chat, the candidate `SELF` owner can invite them into the active call.

---

## Notification Module

Base path: `/api/v1/notifications`

This module stores in-app notification rows and supports Firebase push delivery through the BullMQ notification worker. Flutter and React clients should register device tokens through `POST /users/devices`.

Security rules:

- all endpoints require `Authorization: Bearer <accessToken>`
- users can only read or update their own notifications
- notification rows are saved even when the user has no active FCM device token

### `GET /`

Purpose:

- List current user's notifications newest first

Auth:

- Bearer token, any role

Query:

- `page`: default `1`
- `limit`: default `20`, max `100`
- `isSeen`: optional boolean filter

Example:

```http
GET /api/v1/notifications?page=1&limit=20&isSeen=false
Authorization: Bearer <accessToken>
```

### `PATCH /:id/seen`

Purpose:

- Mark one notification as seen

Auth:

- Bearer token, any role

Example:

```http
PATCH /api/v1/notifications/665f1a2b3c4d5e6f78901234/seen
Authorization: Bearer <accessToken>
```

Marriage notification data includes:

- `type: "MARRIAGE_REQUEST"`
- `entityId`: marriage request or progress id
- `deepLink`: Flutter/mobile route target
- `webUrl`: React/web route target
- `data.requestId`, `data.progressId`, `data.pairKey`, `data.candidateIds`, and `data.action`

---

## Rishta Progress Module

Base path: `/api/v1/rishta-progress`

This module tracks a candidate pair through the rishta journey and handles marriage confirmation approval.

Progress steps:

- `MATCHES`: completed when mutual swipe creates/returns a match
- `START_CHAT`: completed when a match chat starts, a message is sent, or a message request is accepted
- `PARENT_INVOLVES`: completed when an accepted parent/family/guardian request includes a family linked user in chat
- `SHAADI`: completed only by accepted marriage approval or admin direct confirmation

Security rules:

- candidate progress read requires active linked-user access for the provided `candidateId`
- candidate marriage request creation requires `OWNER` access for one candidate in the pair
- candidate marriage request listing requires `OWNER` access for the provided `candidateId`
- consultant marriage request creation requires the consultant user to be actively linked as `CONSULTANT` to at least one candidate in the pair
- accepting/rejecting marriage requests requires `OWNER` access for the responding candidate
- admin direct confirmation requires `ADMIN`
- married candidates are excluded from swipe feed and cannot perform new swipe actions

### `GET /`

Purpose:

- Get or create the rishta progress row for a pair

Auth:

- `USER`

Query must include `candidateId` plus one locator:

- `otherCandidateId`
- `matchId`
- `conversationId`
- `progressId`

Example:

```http
GET /api/v1/rishta-progress?candidateId={{candidateA}}&otherCandidateId={{candidateB}}
Authorization: Bearer {{tokenA}}
```

Response data shape:

```json
{
  "_id": "progress id",
  "pairKey": "candidateA_candidateB",
  "candidates": ["candidateA", "candidateB"],
  "completedSteps": ["MATCHES", "START_CHAT"],
  "progressValue": 50,
  "status": "ACTIVE",
  "match": "match id",
  "conversation": "conversation id",
  "marriedAt": null
}
```

### `POST /marriage-requests`

Purpose:

- Create a marriage confirmation request

Auth:

- `USER` candidate owner or `CONSULTANT`

Body must include one pair locator:

```json
{
  "candidateId": "candidate A id",
  "otherCandidateId": "candidate B id"
}
```

Alternate body examples:

```json
{ "matchId": "match id" }
```

```json
{ "conversationId": "conversation id" }
```

Behavior:

- candidate owner request auto-approves the requester's candidate side and notifies the opposite candidate owners
- consultant request notifies both candidate owner sides and requires both sides to accept
- only one pending marriage request can exist for a pair
- notification rows and push jobs are created for target owners

### `GET /marriage-requests`

Purpose:

- List marriage confirmation requests involving the current candidate

Auth:

- `USER` owner

Query:

- `candidateId`: required current candidate id
- `page`: default `1`
- `limit`: default `20`, max `100`
- `status`: optional `PENDING`, `ACCEPTED`, `REJECTED`, or `CANCELLED`
- `sort`: optional, default `-createdAt`

Example:

```http
GET /api/v1/rishta-progress/marriage-requests?candidateId={{candidateB}}&page=1&limit=20&status=PENDING
Authorization: Bearer {{tokenB}}
```

Response:

```json
{
  "data": [
    {
      "_id": "marriage request id",
      "pairKey": "candidateA_candidateB",
      "progress": "progress id",
      "candidates": ["candidateA", "candidateB"],
      "status": "PENDING",
      "requestedByRole": "USER",
      "requestedByUser": {
        "_id": "requester user id",
        "full_name": "Requester Name",
        "email": "requester@example.com",
        "phone": "+8801000000000",
        "picture": "https://example.com/avatar.jpg",
        "role": "USER"
      },
      "requestedByCandidate": {
        "_id": "candidateA",
        "name": "Amina",
        "age": 27,
        "gender": "FEMALE",
        "images": ["image-1.jpg", "image-2.jpg"],
        "livesIn": "Dhaka",
        "religion": "ISLAM",
        "occupation": "ENGINEER"
      },
      "otherCandidate": {
        "_id": "candidateA",
        "name": "Amina",
        "age": 27,
        "gender": "FEMALE",
        "images": ["image-1.jpg", "image-2.jpg"],
        "livesIn": "Dhaka",
        "religion": "ISLAM",
        "occupation": "ENGINEER"
      },
      "currentCandidateApproved": false,
      "canRespond": true,
      "approvals": [],
      "createdAt": "2026-05-21T10:00:00.000Z",
      "updatedAt": "2026-05-21T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPage": 1
  }
}
```

Notes:

- `otherCandidate` is the opposite profile in the request pair and includes at most 2 images.
- `requestedByCandidate` is `null` for consultant-created requests.
- `canRespond` is `true` only for pending requests that the current candidate has not approved yet.

### `PATCH /marriage-requests/:requestId/accept`

Purpose:

- Candidate owner accepts a marriage request for their candidate side

Auth:

- `USER` owner

Body:

```json
{
  "candidateId": "responding candidate id"
}
```

Behavior:

- when both candidate sides have approved, request status becomes `ACCEPTED`
- progress status becomes `MARRIED`
- all progress steps are completed and `progressValue` becomes `100`
- both candidates are removed from future swipe feed results

### `PATCH /marriage-requests/:requestId/reject`

Purpose:

- Candidate owner rejects a marriage request

Auth:

- `USER` owner

Body:

```json
{
  "candidateId": "responding candidate id",
  "rejectReason": "This request is not valid"
}
```

### `POST /admin/married`

Purpose:

- Admin directly confirms a couple as married

Auth:

- `ADMIN`

Body:

```json
{
  "candidateId": "candidate A id",
  "otherCandidateId": "candidate B id"
}
```

Behavior:

- completes all progress steps immediately
- cancels any pending marriage request for the pair
- notifies candidate owner users

### `GET /married`

Purpose:

- List married couples

Auth:

- `ADMIN` or `CONSULTANT`

Query:

- `page`: default `1`
- `limit`: default `20`, max `100`

Behavior:

- admin sees all married couples
- consultant sees only couples finalized through that consultant's accepted marriage request

---

## Document Module

Base path: `/api/v1/documents`

This module stores candidate verification documents and updates the candidate verification status fields.

Security rules:

- all endpoints require `Authorization: Bearer <accessToken>`
- allowed roles: `USER` and `ADMIN`
- upload routes use `multipart/form-data`
- file field name is `documents`
- accepted document files are `image/*` and `application/pdf`
- ID/education upload accepts up to 10 files
- parent ID upload accepts up to 2 files
- backend uploads the file to Cloudinary and saves the Cloudinary secure URL in DB
- ID and education documents can be re-uploaded until that document type is approved
- parent verification uses separate parent endpoints inside this same module

Allowed document types:

- `ID`
- `EDUCATION`
- `PARENT`
- `PARENT_PHOTO`
- `PARENT_ID`
- `FACE`

Document verification statuses:

- `NONE`
- `PENDING`
- `APPROVED`
- `REJECTED`

### `POST /face-verification`

Purpose:

- Save the frontend face-match result for a candidate
- Mark `candidate.verification_status.face_verified` as `APPROVED` when `isFaceVerified` is `true`
- Mark `candidate.verification_status.face_verified` as `REJECTED` when `isFaceVerified` is `false`

Auth:

- Bearer token
- `USER` or `ADMIN`

Body:

```json
{
  "candidateId": "665f1a2b3c4d5e6f78901234",
  "isFaceVerified": true
}
```

Behavior:

- rejects the request if the candidate does not exist
- rejects the request if face verification is already approved
- updates the current face verification status
- appends the result to `candidate.face_verify_logs`
- this endpoint does not upload a file or create a document row

Response data shape:

```json
{
  "candidate": "665f1a2b3c4d5e6f78901234",
  "face_verified": {
    "status": "APPROVED",
    "date": "2026-05-14T00:00:00.000Z",
    "success": true
  }
}
```

### `POST /parent/photo`

Purpose:

- Upload the parent/guardian photo used for parent face verification
- Mark `candidate.verification_status.parent_verified` as `PENDING`

Auth:

- Bearer token
- `USER` or `ADMIN`

Form data:

```text
candidateId: 665f1a2b3c4d5e6f78901234
photo: <parent image file>
```

Behavior:

- accepts image files only
- creates a `PARENT_PHOTO` document row
- rejects if parent verification is already approved
- rejects if a parent photo is already face verified
- replaces older pending parent photo uploads as rejected history

### `POST /parent/face-verification`

Purpose:

- Save the frontend parent/guardian face-match result
- Approve the latest pending parent photo when `isFaceVerified` is `true`
- Reject the latest pending parent photo when `isFaceVerified` is `false`

Auth:

- Bearer token
- `USER` or `ADMIN`

Body:

```json
{
  "candidateId": "665f1a2b3c4d5e6f78901234",
  "isFaceVerified": true
}
```

Behavior:

- requires a pending parent photo upload first
- if parent ID is already approved, successful face verification marks `parent_verified` as `APPROVED`
- if parent ID is not approved yet, successful face verification keeps `parent_verified` as `PENDING`
- failed face verification marks `parent_verified` as `REJECTED`

### `POST /parent/id-card`

Purpose:

- Upload the parent/guardian government ID card for admin review
- Mark `candidate.verification_status.parent_verified` as `PENDING`

Auth:

- Bearer token
- `USER` or `ADMIN`

Form data:

```text
candidateId: 665f1a2b3c4d5e6f78901234
documents: <parent ID front image or pdf>
documents: <parent ID back image or pdf>
titles: ["Front side", "Back side"] optional
```

Behavior:

- accepts PDF or image files
- creates a `PARENT_ID` document row
- rejects if parent verification is already approved
- rejects if parent ID is already approved
- replaces older pending parent ID uploads as rejected history
- admin reviews this document with the same approve/reject endpoints below

### `POST /upload`

Purpose:

- Save an ID or education verification document for review
- Mark the document as `PENDING`
- Update the matching candidate verification status field to `PENDING`

Auth:

- Bearer token
- `USER` or `ADMIN`

Form data:

```text
candidateId: 665f1a2b3c4d5e6f78901234
type: ID
documents: <front side pdf or image file>
documents: <back side pdf or image file>
titles: ["Front side", "Back side"] optional for ID
```

Education upload example:

```text
candidateId: 665f1a2b3c4d5e6f78901234
type: EDUCATION
documents: <bachelors certificate pdf or image file>
documents: <masters certificate pdf or image file>
titles: ["Bachelors degree certificate", "Masters degree certificate"]
```

Behavior by type:

- `ID` updates `candidate.verification_status.id_verified`
- `EDUCATION` updates `candidate.verification_status.education_verified`
- `ID` can include multiple files, such as front and back side
- `EDUCATION` can include multiple certificate files
- every education file must have a matching title so admin can understand the certificate
- `FACE` does not use this route
- parent verification uses `/parent/photo`, `/parent/face-verification`, and `/parent/id-card`
- rejects upload if the same document type is already approved
- if the same document type already has a pending upload, the old pending row is marked `REJECTED` with `rejected_reason: "Replaced by a new upload"`
- rejects the request if `documents` files are missing or not PDF/image

Response data shape:

```json
{
  "_id": "document id",
  "candidate": "665f1a2b3c4d5e6f78901234",
  "type": "ID",
  "document": "https://res.cloudinary.com/demo/image/upload/v1/RistaPro/nid-front.jpg",
  "documents": [
    {
      "file": "https://res.cloudinary.com/demo/image/upload/v1/RistaPro/nid-front.jpg",
      "title": "Front side"
    },
    {
      "file": "https://res.cloudinary.com/demo/image/upload/v1/RistaPro/nid-back.jpg",
      "title": "Back side"
    }
  ],
  "verification_status": "PENDING",
  "createdAt": "2026-05-14T00:00:00.000Z",
  "updatedAt": "2026-05-14T00:00:00.000Z"
}
```

### `PATCH /:documentId/approve`

Purpose:

- Admin approves a pending ID, education, or parent ID document
- Update the matching candidate verification field to `APPROVED`
- Lock that document type from further user uploads

Auth:

- Bearer token
- `ADMIN`

Example:

```http
PATCH /api/v1/documents/665f1a2b3c4d5e6f78909999/approve
Authorization: Bearer <adminAccessToken>
```

Behavior:

- only works for `ID`, `EDUCATION`, and `PARENT_ID` documents
- only pending documents can be approved
- rejects if another document of the same type is already approved
- clears `rejected_reason` on the approved document
- marks other pending documents of the same type as rejected
- for `PARENT_ID`, `parent_verified` becomes `APPROVED` only if the parent photo face check is also approved

### `PATCH /:documentId/reject`

Purpose:

- Admin rejects an ID, education, or parent ID document with a reason
- Update the matching candidate verification field to `REJECTED`
- Keep the rejected document row as visible history

Auth:

- Bearer token
- `ADMIN`

Body:

```json
{
  "rejected_reason": "Document is blurry. Please upload a clearer image."
}
```

Behavior:

- only works for `ID`, `EDUCATION`, and `PARENT_ID` documents
- only pending documents can be rejected
- after rejection, user can upload a new document of the same type

### `GET /:candidateId`

Purpose:

- List all verification documents for one candidate, including rejected history

Auth:

- Bearer token
- `USER` or `ADMIN`

Example:

```http
GET /api/v1/documents/665f1a2b3c4d5e6f78901234
Authorization: Bearer <accessToken>
```

Response:

- returns documents sorted by newest first
- rejected rows include `rejected_reason`, so the user can see why a previous upload failed

Response data shape:

```json
[
  {
    "_id": "document id",
    "candidate": "665f1a2b3c4d5e6f78901234",
    "type": "ID",
    "document": "https://res.cloudinary.com/demo/image/upload/v1/RistaPro/nid-front.jpg",
    "documents": [
      {
        "file": "https://res.cloudinary.com/demo/image/upload/v1/RistaPro/nid-front.jpg",
        "title": "Front side"
      },
      {
        "file": "https://res.cloudinary.com/demo/image/upload/v1/RistaPro/nid-back.jpg",
        "title": "Back side"
      }
    ],
    "verification_status": "PENDING",
    "rejected_reason": "optional rejection reason",
    "createdAt": "2026-05-14T00:00:00.000Z",
    "updatedAt": "2026-05-14T00:00:00.000Z"
  }
]
```

---

## Postman Testing Guide: Swipe To Match

Use two normal user accounts with one active candidate profile each. The target candidate's owner account must be active, not deleted, and verified, otherwise the feed/action APIs will reject the target as unavailable.

Create these Postman environment variables:

```text
baseUrl=http://localhost:3000/api/v1
tokenA=
tokenB=
candidateA=
candidateB=
matchId=
conversationId=
```

### 1. Login account A

```http
POST {{baseUrl}}/auth/login
Content-Type: application/json
```

Body:

```json
{
  "email": "candidate-a@example.com",
  "password": "StrongPass1!"
}
```

Postman Tests script:

```js
const json = pm.response.json();
pm.environment.set('tokenA', json.data.accessToken);
```

### 2. Load candidate A

```http
GET {{baseUrl}}/candidates/my_linked_profiles
Authorization: Bearer {{tokenA}}
```

Postman Tests script:

```js
const json = pm.response.json();
pm.environment.set('candidateA', json.data[0].candidate._id);
```

### 3. Login account B and load candidate B

Repeat steps 1 and 2 with account B, but save the values as `tokenB` and `candidateB`.

### 4. Test candidate A feed

```http
GET {{baseUrl}}/swipes/feed?candidateId={{candidateA}}&limit=20
Authorization: Bearer {{tokenA}}
```

Expected:

- `data.cards` is the discovery stack
- use a card `_id` as `targetCandidateId`
- `nextCursor` can be sent as `cursor` for the next page

For a controlled mutual-match test, use `candidateB` as the target.

### 5. Candidate A likes candidate B

```http
POST {{baseUrl}}/swipes/action
Authorization: Bearer {{tokenA}}
Content-Type: application/json
```

Body:

```json
{
  "candidateId": "{{candidateA}}",
  "targetCandidateId": "{{candidateB}}",
  "type": "LIKE",
  "source": "FEED"
}
```

Expected:

- `data.matched` is usually `false` if candidate B has not liked candidate A yet
- `data.quota` shows remaining daily likes and super likes

### 6. Candidate B likes candidate A

```http
POST {{baseUrl}}/swipes/action
Authorization: Bearer {{tokenB}}
Content-Type: application/json
```

Body:

```json
{
  "candidateId": "{{candidateB}}",
  "targetCandidateId": "{{candidateA}}",
  "type": "LIKE",
  "source": "FEED"
}
```

Expected:

- `data.matched` should be `true`
- `data.match._id` is the match id
- `data.match.conversation` is the auto-created conversation id

Postman Tests script:

```js
const json = pm.response.json();
pm.environment.set('matchId', json.data.match._id);
pm.environment.set('conversationId', json.data.match.conversation);
```

### 7. List matches for candidate A

```http
GET {{baseUrl}}/matches?candidateId={{candidateA}}
Authorization: Bearer {{tokenA}}
```

Expected:

- the new match appears with `status: "ACTIVE"`
- `conversation` matches `{{conversationId}}`
- `candidates` contains compact profile cards for both sides

### 8. Get one match

```http
GET {{baseUrl}}/matches/{{matchId}}?candidateId={{candidateA}}
Authorization: Bearer {{tokenA}}
```

Expected:

- returns the same match detail
- use this endpoint when the frontend opens a match detail/chat entry point

### 9. Optional: unmatch

```http
PATCH {{baseUrl}}/matches/{{matchId}}/unmatched?candidateId={{candidateA}}
Authorization: Bearer {{tokenA}}
```

Expected:

- `data.status` becomes `UNMATCHED`
- the open match conversation is archived
- the match no longer appears in `GET /matches?candidateId={{candidateA}}`

## Postman Testing Guide: Chat

Reuse these variables from the swipe/match guide:

```text
baseUrl=http://localhost:3000/api/v1
tokenA=
tokenB=
candidateA=
candidateB=
matchId=
conversationId=
messageRequestId=
guardianRequestId=
guardianLinkedUserId=
```

### Start chat from a match

```http
POST {{baseUrl}}/conversations/matches/{{matchId}}/start?candidateId={{candidateA}}
Authorization: Bearer {{tokenA}}
```

Expected:

- `data._id` is the conversation id
- save it as `conversationId` if it was not already returned by swipe matching

### Send a message

```http
POST {{baseUrl}}/messages
Authorization: Bearer {{tokenA}}
Content-Type: application/json
```

Body:

```json
{
  "conversationId": "{{conversationId}}",
  "candidateId": "{{candidateA}}",
  "message": "Assalamu alaikum"
}
```

### Load messages

```http
GET {{baseUrl}}/conversations/{{conversationId}}/messages?candidateId={{candidateB}}&limit=50
Authorization: Bearer {{tokenB}}
```

### Mark read

```http
PATCH {{baseUrl}}/conversations/{{conversationId}}/read
Authorization: Bearer {{tokenB}}
Content-Type: application/json
```

Body:

```json
{
  "candidateId": "{{candidateB}}"
}
```

### Start chat by message request

A sends:

```http
POST {{baseUrl}}/conversations/message_requests
Authorization: Bearer {{tokenA}}
Content-Type: application/json
```

Body:

```json
{
  "requesterCandidateId": "{{candidateA}}",
  "targetCandidateId": "{{candidateB}}",
  "firstMessage": "Can we start a conversation?"
}
```

B lists and accepts:

```http
GET {{baseUrl}}/conversations/message_requests?candidateId={{candidateB}}&type=incoming&status=PENDING
Authorization: Bearer {{tokenB}}
```

```http
PATCH {{baseUrl}}/conversations/message-requests/{{messageRequestId}}/accept
Authorization: Bearer {{tokenB}}
Content-Type: application/json
```

Body:

```json
{
  "candidateId": "{{candidateB}}"
}
```

### Include a guardian or parent

Use `GET /candidates/{{candidateA}}/linked_users` to find a father, mother, or guardian linked user id, then A sends:

```http
POST {{baseUrl}}/conversations/{{conversationId}}/guardian-requests
Authorization: Bearer {{tokenA}}
Content-Type: application/json
```

Body:

```json
{
  "candidateId": "{{candidateA}}",
  "linkedUserId": "{{guardianLinkedUserId}}",
  "message": "I want to include my parent in this chat."
}
```

B accepts:

```http
PATCH {{baseUrl}}/conversations/guardian-requests/{{guardianRequestId}}/accept
Authorization: Bearer {{tokenB}}
Content-Type: application/json
```

Body:

```json
{
  "candidateId": "{{candidateB}}"
}
```

After acceptance, the guardian account can call the conversation/message APIs using `candidateId={{candidateA}}`.

## Postman Testing Guide: Rishta Progress And Marriage Approval

Reuse these variables:

```text
baseUrl=http://localhost:3000/api/v1
tokenA=
tokenB=
adminToken=
consultantToken=
candidateA=
candidateB=
matchId=
conversationId=
progressId=
marriageRequestId=
```

### Load rishta progress

```http
GET {{baseUrl}}/rishta-progress?candidateId={{candidateA}}&otherCandidateId={{candidateB}}
Authorization: Bearer {{tokenA}}
```

Expected:

- `completedSteps` reflects automatic progress events
- `progressValue` is `25`, `50`, `75`, or `100`
- save `data._id` as `progressId`

### Candidate owner creates marriage request

```http
POST {{baseUrl}}/rishta-progress/marriage-requests
Authorization: Bearer {{tokenA}}
Content-Type: application/json
```

Body:

```json
{
  "candidateId": "{{candidateA}}",
  "otherCandidateId": "{{candidateB}}"
}
```

Expected:

- request status is `PENDING`
- candidate A side is already in `approvals`
- candidate B owner receives a `MARRIAGE_REQUEST` notification

### Candidate B lists marriage requests

```http
GET {{baseUrl}}/rishta-progress/marriage-requests?candidateId={{candidateB}}&page=1&limit=20&status=PENDING
Authorization: Bearer {{tokenB}}
```

Expected:

- response includes the pending request involving `candidateB`
- `otherCandidate` contains candidate A basic info with at most 2 images
- `requestedByUser` contains the requester user's basic information
- `canRespond` is `true` until candidate B accepts or rejects the request

### Candidate B accepts

```http
PATCH {{baseUrl}}/rishta-progress/marriage-requests/{{marriageRequestId}}/accept
Authorization: Bearer {{tokenB}}
Content-Type: application/json
```

Body:

```json
{
  "candidateId": "{{candidateB}}"
}
```

Expected:

- request status becomes `ACCEPTED`
- progress status becomes `MARRIED`
- `completedSteps` includes `SHAADI`
- married candidates no longer appear in swipe feeds

### Candidate B rejects instead

```http
PATCH {{baseUrl}}/rishta-progress/marriage-requests/{{marriageRequestId}}/reject
Authorization: Bearer {{tokenB}}
Content-Type: application/json
```

Body:

```json
{
  "candidateId": "{{candidateB}}",
  "rejectReason": "Not valid"
}
```

### Consultant creates marriage request

```http
POST {{baseUrl}}/rishta-progress/marriage-requests
Authorization: Bearer {{consultantToken}}
Content-Type: application/json
```

Body:

```json
{
  "candidateId": "{{candidateA}}",
  "otherCandidateId": "{{candidateB}}"
}
```

Expected:

- both candidate owners receive notifications
- both candidate sides must accept before Shaadi is completed

### Admin directly confirms marriage

```http
POST {{baseUrl}}/rishta-progress/admin/married
Authorization: Bearer {{adminToken}}
Content-Type: application/json
```

Body:

```json
{
  "candidateId": "{{candidateA}}",
  "otherCandidateId": "{{candidateB}}"
}
```

### List married couples

Admin:

```http
GET {{baseUrl}}/rishta-progress/married?page=1&limit=20
Authorization: Bearer {{adminToken}}
```

Consultant:

```http
GET {{baseUrl}}/rishta-progress/married?page=1&limit=20
Authorization: Bearer {{consultantToken}}
```

### Read notifications

```http
GET {{baseUrl}}/notifications?isSeen=false
Authorization: Bearer {{tokenB}}
```

```http
PATCH {{baseUrl}}/notifications/{{notificationId}}/seen
Authorization: Bearer {{tokenB}}
```

## Example Headers

Bearer token request:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Refresh request:

```http
Cookie: refreshToken=<refreshToken>
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
7. Send `/swipes/action` when the user likes, super-likes, or passes a card
8. Send `/visitors/track` when the user opens a profile detail page
9. Load `/visitors?candidateId=<candidateId>` to show who visited the current profile
10. If a swipe response has `matched: true`, store `match._id` and `match.conversation`
11. Load `/matches?candidateId=<candidateId>` for the user's active match list
12. Load `/conversations?candidateId=<candidateId>` for the chat inbox
13. Send `/messages` for text chat
14. Start audio/video calls with `/calls/start` from an open 1-to-1 conversation
15. Renew long call tokens with `/calls/:callId/token` and end calls with `/calls/:callId/end`
16. Use `/conversations/message_requests` when users are not matched yet
17. Use `/conversations/:conversationId/guardian-requests` before allowing a parent or guardian into a chat
18. Invite already-involved linked users into an active call with `/calls/:callId/participants/invite`
19. Load `/rishta-progress?candidateId=<candidateId>&otherCandidateId=<otherCandidateId>` to render the progress widget
20. Use `/rishta-progress/marriage-requests` when a candidate owner or consultant wants to start marriage confirmation
21. Use `GET /rishta-progress/marriage-requests?candidateId=<candidateId>` to show all marriage requests for the current candidate
22. Poll or socket-sync `/notifications` for marriage request alerts and mark opened alerts with `/notifications/:id/seen`
23. Load `/candidates/my_linked_profiles` after login to fetch the current account's candidate access
24. Use linked-user APIs to add father, mother, consultant, or other guardians
25. Platinum candidates load `/consultant/available?candidateId=<candidateId>` and select a consultant
26. Use `POST /consultant/cases/start` to create or reuse the candidate's consultant case thread
27. Use `POST /meeting-schedules` to request a consultant meeting; the response includes the linked `case`
28. Use `/consultant/cases/:caseId/messages` for consultant case chat
29. Consultants use `/consultant/cases/:caseId/candidate-invites` to invite another registered candidate, and the candidate accepts through `/consultant/candidate-invites/:inviteId/accept`
30. Use `/consultant/cases/:caseId/guest-invites` to invite non-user participants into scoped guest chat/video
31. Use `/meeting-schedules/:meetingId/join` for authenticated meeting participants and `/consultant/guest-invites/:token/meetings/:meetingId/join` for public guests
32. Use `/consultant/marriage-records` when a consultant manually records a marriage

---

## Consultant Module

Base path: `/api/v1/consultant`

This module covers the candidate-chosen consultant workflow: consultant discovery, candidate-started cases, case chat, registered-candidate invites, guest invite links, guest-enabled calls, and manual marriage records.

Important rules:

- Candidate-side consultant discovery and case start are Platinum-only through `canUseConsultant`.
- The primary candidate must have Platinum consultant access. A second candidate accepted into the case can chat and join the linked meeting after accepting the invite.
- Candidate `OWNER` and `EDITOR` can write; `VIEWER` can read case/message data only.
- Consultants use `Role.CONSULTANT`; they do not need a paid plan.
- Consultants can access only their own assignments and cases.
- Guest links are public, token-scoped, expire, and never create real `User` or `Candidate` records.
- Existing scheduled meeting logic remains in the `meeting-schedules` module; `/consultant/meeting-requests` is an alias layer over that service.

Common statuses:

- Assignment: `ACTIVE`, `INACTIVE`
- Case: `OPEN`, `ARCHIVED`, `MARRIED`
- Candidate invite: `PENDING`, `ACCEPTED`, `DECLINED`
- Guest invite: `ACTIVE`, `REVOKED`
- Consultant call: `ACTIVE`, `COMPLETED`
- Marriage party type: `CANDIDATE`, `GUEST`

### `GET /available`

Purpose:

- Platinum candidate lists active consultants they can choose from.

Auth:

- Bearer token (`USER`)

Query params:

- `candidateId`: required candidate profile id

Example:

```http
GET /api/v1/consultant/available?candidateId=665f1a2b3c4d5e6f78901234
Authorization: Bearer <userToken>
```

### `POST /cases/start`

Purpose:

- Candidate starts or reuses an open consultation case with a selected consultant.
- Backend automatically creates/reuses the internal consultant-candidate assignment.

Auth:

- Bearer token (`USER`)

Body:

```json
{
  "candidateId": "665f1a2b3c4d5e6f78901234",
  "consultantId": "665f1a2b3c4d5e6f78905678",
  "title": "Consultant support",
  "note": "Need help coordinating a meeting"
}
```

Notes:

- Candidate must be linked as `OWNER` or `EDITOR`.
- Primary candidate must have `canUseConsultant`.
- Duplicate starts with the same consultant return the existing open case.

### `POST /cases`

Purpose:

- Consultant creates a consultation case with one or two real candidates.

Auth:

- Bearer token (`CONSULTANT`)

Body:

```json
{
  "candidateIds": [
    "665f1a2b3c4d5e6f78901234",
    "665f1a2b3c4d5e6f78905678"
  ],
  "title": "Initial rishta discussion",
  "note": "Family intro and expectations"
}
```

Field rules:

- `candidateIds`: required array, one or two unique candidate ids
- each candidate must have an active assignment for the consultant
- `title`: optional string, max 120 chars
- `note`: optional string, max 500 chars

### `GET /cases`

Purpose:

- List consultation cases visible to the current user.

Auth:

- Bearer token (`USER` or `CONSULTANT`)

Query params:

- `candidateId`: required for `USER`, optional for `CONSULTANT`
- `status`: optional, one of `OPEN`, `ARCHIVED`, `MARRIED`

Examples:

```http
GET /api/v1/consultant/cases?candidateId=665f1a2b3c4d5e6f78901234
Authorization: Bearer <userToken>
```

```http
GET /api/v1/consultant/cases?status=OPEN
Authorization: Bearer <consultantToken>
```

### `GET /cases/:caseId`

Purpose:

- Get one consultation case detail.

Auth:

- Bearer token (`USER` or `CONSULTANT`)

Rules:

- Consultant must own the case.
- Candidate user must be linked to one of the case candidates.
- The primary candidate side is checked for Platinum consultant access.

### `POST /cases/:caseId/candidates`

Purpose:

- Consultant adds a second real candidate to an open consultation case.

Auth:

- Bearer token (`CONSULTANT`)

Body:

```json
{
  "candidateId": "665f1a2b3c4d5e6f78905678"
}
```

Notes:

- Case can have at most two real candidates.
- Added candidate must have an active assignment for the consultant.

### `POST /cases/:caseId/candidate-invites`

Purpose:

- Consultant invites another registered candidate into an open consultation case.

Auth:

- Bearer token (`CONSULTANT`)

Body:

```json
{
  "candidateId": "665f1a2b3c4d5e6f78905678"
}
```

Behavior:

- Only the consultant who owns the case can invite.
- Case can contain at most two real candidates.
- Candidate owner/editor receives a notification.
- Candidate is added to the case only after accepting.

### `POST /candidate-invites/:inviteId/accept`

Purpose:

- Invited candidate owner/editor accepts a consultant case invite.

Auth:

- Bearer token (`USER`)

Behavior:

- Adds the invited candidate to the case.
- Creates/reuses the internal consultant assignment for that candidate.
- Accepted candidate owner/editor can chat and join the linked meeting.

### `POST /candidate-invites/:inviteId/decline`

Purpose:

- Invited candidate owner/editor declines a consultant case invite.

Auth:

- Bearer token (`USER`)

### `GET /cases/:caseId/messages`

Purpose:

- List authenticated consultant case messages.

Auth:

- Bearer token (`USER` or `CONSULTANT`)

Query params:

- `page`: optional, default `1`
- `limit`: optional, default `30`, max `100`

Example:

```http
GET /api/v1/consultant/cases/665f1a2b3c4d5e6f78909999/messages?page=1&limit=30
Authorization: Bearer <accessToken>
```

### `POST /cases/:caseId/messages`

Purpose:

- Send a message in a consultant case.

Auth:

- Bearer token (`USER` or `CONSULTANT`)

Body for candidate user:

```json
{
  "candidateId": "665f1a2b3c4d5e6f78901234",
  "message": "We are available tomorrow evening."
}
```

Body for consultant:

```json
{
  "message": "I will coordinate with both families."
}
```

Rules:

- Candidate `OWNER` or `EDITOR` can send.
- Candidate `VIEWER` cannot send.
- Consultant can send only inside their own open case.

### `POST /cases/:caseId/guest-invites`

Purpose:

- Consultant creates a secure invite link for a non-user guest.

Auth:

- Bearer token (`CONSULTANT`)

Body:

```json
{
  "displayName": "Guest Candidate",
  "contact": "+8801700000000",
  "expiresAt": "2026-06-10T10:00:00.000Z"
}
```

Response data shape:

```json
{
  "invite": {
    "_id": "guest invite id",
    "case": "case id",
    "displayName": "Guest Candidate",
    "contact": "+8801700000000",
    "expiresAt": "2026-06-10T10:00:00.000Z",
    "status": "ACTIVE"
  },
  "token": "public-token-shown-once",
  "url": "https://frontend.example.com/consultant/guest-invites/public-token-shown-once"
}
```

Notes:

- Backend stores only a hash of the token.
- The raw token is returned once and should be treated like a secret guest session link.
- If `expiresAt` is omitted, the invite expires after 7 days.

### `GET /guest-invites/:token`

Purpose:

- Public guest reads invite and scoped case summary.

Auth:

- Public token URL

Example:

```http
GET /api/v1/consultant/guest-invites/<token>
```

### `GET /guest-invites/:token/messages`

Purpose:

- Public guest lists messages for the invite's scoped consultation case.

Auth:

- Public token URL

Query params:

- `page`: optional, default `1`
- `limit`: optional, default `30`, max `100`

### `POST /guest-invites/:token/messages`

Purpose:

- Public guest sends a message into the invite's scoped consultation case.

Auth:

- Public token URL

Body:

```json
{
  "message": "I can join the discussion today."
}
```

### `POST /guest-invites/:token/meetings/:meetingId/join`

Purpose:

- Public guest joins a scheduled meeting linked to the invite's consultation case.

Auth:

- Public token URL

Notes:

- Meeting must be linked to the same case as the guest invite.
- Join is only allowed inside the meeting join window.
- Returns Agora `appId`, `channelName`, `token`, and numeric `uid`.

### `POST /marriage-records`

Purpose:

- Consultant manually records a marriage.

Auth:

- Bearer token (`CONSULTANT`)

Candidate + candidate body:

```json
{
  "caseId": "665f1a2b3c4d5e6f78909999",
  "marriedAt": "2026-06-01T10:00:00.000Z",
  "note": "Marriage completed by consultant.",
  "parties": [
    {
      "partyType": "CANDIDATE",
      "candidateId": "665f1a2b3c4d5e6f78901234"
    },
    {
      "partyType": "CANDIDATE",
      "candidateId": "665f1a2b3c4d5e6f78905678"
    }
  ]
}
```

Candidate + guest body:

```json
{
  "caseId": "665f1a2b3c4d5e6f78909999",
  "parties": [
    {
      "partyType": "CANDIDATE",
      "candidateId": "665f1a2b3c4d5e6f78901234"
    },
    {
      "partyType": "GUEST",
      "guestInviteId": "665f1a2b3c4d5e6f78908888"
    }
  ]
}
```

Guest + guest body:

```json
{
  "parties": [
    {
      "partyType": "GUEST",
      "displayName": "Guest One",
      "contact": "+8801700000001"
    },
    {
      "partyType": "GUEST",
      "displayName": "Guest Two",
      "contact": "+8801700000002"
    }
  ]
}
```

Behavior:

- Stores a `ConsultantMarriageRecord`.
- If both parties are real candidates, the matching `RishtaProgress` is marked `MARRIED`.
- Candidate-candidate manual marriage clears swipe feed cache for both candidates.
- If the record is attached to a case and both parties are real candidates, the case becomes `MARRIED`.

### `GET /marriage-records`

Purpose:

- Consultant lists their manual marriage records.

Auth:

- Bearer token (`CONSULTANT`)

Query params:

- `caseId`: optional case filter
- `page`: optional, default `1`
- `limit`: optional, default `20`, max `100`

Example:

```http
GET /api/v1/consultant/marriage-records?page=1&limit=20
Authorization: Bearer <consultantToken>
```

---

## Postman Testing Guide: Consultant Module

Add these variables to your Postman environment:

```text
baseUrl=http://localhost:3000/api/v1
tokenA=
tokenB=
consultantToken=
consultantId=
candidateA=
candidateB=
caseId=
candidateInviteId=
meetingId=
guestToken=
guestInviteId=
consultantCallId=
```

### 1. Candidate lists available consultants

```http
GET {{baseUrl}}/consultant/available?candidateId={{candidateA}}
Authorization: Bearer {{tokenA}}
```

### 2. Candidate starts consultant case

```http
POST {{baseUrl}}/consultant/cases/start
Authorization: Bearer {{tokenA}}
Content-Type: application/json
```

Body:

```json
{
  "candidateId": "{{candidateA}}",
  "consultantId": "{{consultantId}}",
  "title": "Family discussion",
  "note": "Need help coordinating the discussion"
}
```

Postman Tests script:

```js
const json = pm.response.json();
pm.environment.set('caseId', json.data._id);
```

### 3. Candidate requests linked meeting

```http
POST {{baseUrl}}/meeting-schedules
Authorization: Bearer {{tokenA}}
Content-Type: application/json
```

Body:

```json
{
  "candidateId": "{{candidateA}}",
  "consultantId": "{{consultantId}}",
  "requestedTimeSlots": ["2026-06-01T10:00:00.000Z"],
  "note": "Prefer morning slots"
}
```

Expected:

- Response includes `data.case` with the linked consultation case id.

Postman Tests script:

```js
const json = pm.response.json();
pm.environment.set('meetingId', json.data._id);
pm.environment.set('caseId', json.data.case);
```

### 4. Candidate lists cases

```http
GET {{baseUrl}}/consultant/cases?candidateId={{candidateA}}
Authorization: Bearer {{tokenA}}
```

Expected:

- Platinum candidate owner/editor/viewer can read.

### 5. Send case messages

Candidate message:

```http
POST {{baseUrl}}/consultant/cases/{{caseId}}/messages
Authorization: Bearer {{tokenA}}
Content-Type: application/json
```

```json
{
  "candidateId": "{{candidateA}}",
  "message": "We are ready to discuss."
}
```

Consultant message:

```http
POST {{baseUrl}}/consultant/cases/{{caseId}}/messages
Authorization: Bearer {{consultantToken}}
Content-Type: application/json
```

```json
{
  "message": "I will coordinate the meeting."
}
```

### 6. Consultant invites registered candidate

```http
POST {{baseUrl}}/consultant/cases/{{caseId}}/candidate-invites
Authorization: Bearer {{consultantToken}}
Content-Type: application/json
```

Body:

```json
{
  "candidateId": "{{candidateB}}"
}
```

Postman Tests script:

```js
const json = pm.response.json();
pm.environment.set('candidateInviteId', json.data._id);
```

Candidate B accepts:

```http
POST {{baseUrl}}/consultant/candidate-invites/{{candidateInviteId}}/accept
Authorization: Bearer {{tokenB}}
```

### 7. Consultant creates guest invite

```http
POST {{baseUrl}}/consultant/cases/{{caseId}}/guest-invites
Authorization: Bearer {{consultantToken}}
Content-Type: application/json
```

Body:

```json
{
  "displayName": "Guest Candidate",
  "contact": "+8801700000000"
}
```

Postman Tests script:

```js
const json = pm.response.json();
pm.environment.set('guestToken', json.data.token);
pm.environment.set('guestInviteId', json.data.invite._id);
```

### 8. Guest reads and sends messages

```http
GET {{baseUrl}}/consultant/guest-invites/{{guestToken}}/messages
```

```http
POST {{baseUrl}}/consultant/guest-invites/{{guestToken}}/messages
Content-Type: application/json
```

Body:

```json
{
  "message": "Guest has joined the consultation."
}
```

Guest joins linked scheduled meeting:

```http
POST {{baseUrl}}/consultant/guest-invites/{{guestToken}}/meetings/{{meetingId}}/join
```

### 9. Start and join consultant call

```http
POST {{baseUrl}}/consultant/calls/start
Authorization: Bearer {{consultantToken}}
Content-Type: application/json
```

Body:

```json
{
  "caseId": "{{caseId}}"
}
```

Postman Tests script:

```js
const json = pm.response.json();
pm.environment.set('consultantCallId', json.data.call._id);
```

Guest joins:

```http
POST {{baseUrl}}/consultant/guest-invites/{{guestToken}}/calls/{{consultantCallId}}/join
```

Candidate joins:

```http
POST {{baseUrl}}/consultant/calls/{{consultantCallId}}/join
Authorization: Bearer {{tokenA}}
Content-Type: application/json
```

Body:

```json
{
  "candidateId": "{{candidateA}}"
}
```

### 10. Consultant creates manual marriage record

```http
POST {{baseUrl}}/consultant/marriage-records
Authorization: Bearer {{consultantToken}}
Content-Type: application/json
```

Body:

```json
{
  "caseId": "{{caseId}}",
  "parties": [
    {
      "partyType": "CANDIDATE",
      "candidateId": "{{candidateA}}"
    },
    {
      "partyType": "GUEST",
      "guestInviteId": "{{guestInviteId}}"
    }
  ],
  "note": "Manual record created by consultant."
}
```

For candidate-candidate records, send two `CANDIDATE` parties. That also marks the pair's `RishtaProgress` as `MARRIED`.

---

## Meeting Schedule Module

Base path: `/api/v1/meeting-schedules`

This module lets candidates request a video consultation with a consultant, and lets consultants confirm, reschedule, and host those meetings using Agora RTC.

Meeting statuses:

- `PENDING`: candidate has submitted a request, waiting for consultant to confirm
- `CONFIRMED`: consultant has set a schedule time
- `RESCHEDULE_REQUESTED`: either side has requested a new time
- `COMPLETED`: meeting has ended
- `CANCELLED`: meeting was cancelled
- `REJECTED`: consultant rejected the request

Security rules:

- `POST /` requires `USER` role
- `GET /` and `GET /:meetingId` require `USER` or `CONSULTANT`
- `PATCH /:meetingId/confirm` requires `CONSULTANT`
- `PATCH /:meetingId/reschedule` requires `USER` or `CONSULTANT`
- `POST /:meetingId/join` requires `USER` or `CONSULTANT`
- Primary candidate-side access requires linked candidate access and Platinum `canUseConsultant`
- Meetings created through this API create/reuse a linked consultant case and return `case`
- Public guests join linked meetings through `/api/v1/consultant/guest-invites/:token/meetings/:meetingId/join`

### `POST /`

Purpose:

- Candidate requests a consultation meeting with a specific consultant
- Optionally provides up to 5 preferred time slots

Auth:

- Bearer token (`USER`)

Body:

```json
{
  "candidateId": "665f1a2b3c4d5e6f78901234",
  "consultantId": "665f1a2b3c4d5e6f78905678",
  "requestedTimeSlots": [
    "2026-06-01T10:00:00.000Z",
    "2026-06-02T14:00:00.000Z"
  ],
  "type": "VIDEO",
  "note": "I prefer morning slots"
}
```

Field rules:

- `candidateId`: required, valid MongoDB ObjectId
- `consultantId`: required, valid MongoDB ObjectId
- `requestedTimeSlots`: optional array of future dates, max 5 items
- `type`: required, `AUDIO` or `VIDEO`
- `note`: optional string, max 500 chars

Behavior:

- Creates or reuses the candidate's open consultation case with the selected consultant.
- Creates/reuses the internal assignment needed by older consultant case APIs.
- Response includes the linked consultant case id as `case`.

### `GET /`

Purpose:

- List meeting schedules for the current user

Auth:

- Bearer token (`USER` or `CONSULTANT`)

Query params:

- `candidateId`: required for `USER`, optional for `CONSULTANT`
- `status`: optional, one of `PENDING`, `CONFIRMED`, `RESCHEDULE_REQUESTED`, `COMPLETED`, `CANCELLED`, `REJECTED`

Example:

```http
GET /api/v1/meeting-schedules?candidateId=665f1a2b3c4d5e6f78901234&status=PENDING
Authorization: Bearer <accessToken>
```

### `GET /:meetingId`

Purpose:

- Get one meeting schedule detail

Auth:

- Bearer token (`USER` or `CONSULTANT`)

Example:

```http
GET /api/v1/meeting-schedules/665f1a2b3c4d5e6f78909999
Authorization: Bearer <accessToken>
```

### `PATCH /:meetingId/confirm`

Purpose:

- Consultant confirms the meeting and sets the final schedule time

Auth:

- Bearer token (`CONSULTANT`)

Body:

```json
{
  "schedule_time": "2026-06-01T10:00:00.000Z",
  "consultantNote": "See you then"
}
```

Field rules:

- `schedule_time`: required, must be a future date
- `consultantNote`: optional string, max 500 chars

Behavior:

- meeting status becomes `CONFIRMED`
- a join window is calculated around `schedule_time`
- a one-hour reminder notification is scheduled

### `PATCH /:meetingId/reschedule`

Purpose:

- Either side requests a new time or the consultant sets a new confirmed time

Auth:

- Bearer token (`USER` or `CONSULTANT`)

Body:

```json
{
  "requestedTimeSlots": ["2026-06-03T09:00:00.000Z"],
  "note": "Can we move to Thursday?",
  "consultantNote": "Rescheduling due to conflict"
}
```

Field rules:

- at least one of `requestedTimeSlots`, `schedule_time`, `note`, or `consultantNote` is required
- `requestedTimeSlots`: optional array of future dates, max 5 items
- `schedule_time`: optional future date (consultant sets confirmed time directly)
- `note`: optional string, max 500 chars
- `consultantNote`: optional string, max 500 chars

Behavior:

- meeting status becomes `RESCHEDULE_REQUESTED` when a candidate sends new time slots
- meeting status becomes `CONFIRMED` when a consultant sets `schedule_time` directly

### `POST /:meetingId/join`

Purpose:

- Participant joins the meeting room and receives an Agora RTC token

Auth:

- Bearer token (`USER` or `CONSULTANT`)

Body:

```json
{
  "candidateId": "665f1a2b3c4d5e6f78901234"
}
```

Notes:

- `candidateId` is accepted for `USER` role and should be sent when the user is joining as a specific case candidate; omit for `CONSULTANT`
- join is only allowed within the meeting join window
- accepted second candidates in the linked case can join after accepting the candidate invite
- returns Agora `appId`, `channelName`, `token`, and numeric `uid`
- client joins Agora with those values to start the video call

Response data shape:

```json
{
  "meeting": {
    "_id": "meeting id",
    "case": "consultation case id",
    "status": "CONFIRMED",
    "schedule_time": "2026-06-01T10:00:00.000Z",
    "agoraChannelName": "meeting_665f1a2b3c4d5e6f78909999",
    "joinWindowStartsAt": "2026-06-01T09:50:00.000Z",
    "joinWindowEndsAt": "2026-06-01T11:00:00.000Z"
  },
  "agora": {
    "appId": "Agora app id",
    "channelName": "meeting_665f1a2b3c4d5e6f78909999",
    "token": "Agora RTC token",
    "uid": 654321,
    "expiresAt": "2026-06-01T11:00:00.000Z"
  }
}
```

---

## Postman Testing Guide: Meeting Schedule

Add these variables to your Postman environment:

```text
baseUrl=http://localhost:3000/api/v1
tokenA=
consultantToken=
candidateA=
consultantId=
meetingId=
```

### 1. Candidate requests a meeting

```http
POST {{baseUrl}}/meeting-schedules
Authorization: Bearer {{tokenA}}
Content-Type: application/json
```

Body:

```json
{
  "candidateId": "{{candidateA}}",
  "consultantId": "{{consultantId}}",
  "requestedTimeSlots": [
    "2026-06-01T10:00:00.000Z",
    "2026-06-02T14:00:00.000Z"
  ],
  "type": "VIDEO",
  "note": "Prefer morning slots"
}
```

Postman Tests script:

```js
const json = pm.response.json();
pm.environment.set('meetingId', json.data._id);
```

### 2. Consultant lists pending meetings

```http
GET {{baseUrl}}/meeting-schedules?status=PENDING
Authorization: Bearer {{consultantToken}}
```

### 3. Consultant confirms the meeting

```http
PATCH {{baseUrl}}/meeting-schedules/{{meetingId}}/confirm
Authorization: Bearer {{consultantToken}}
Content-Type: application/json
```

Body:

```json
{
  "schedule_time": "2026-06-01T10:00:00.000Z",
  "consultantNote": "Looking forward to it"
}
```

### 4. Candidate joins the meeting

```http
POST {{baseUrl}}/meeting-schedules/{{meetingId}}/join
Authorization: Bearer {{tokenA}}
Content-Type: application/json
```

Body:

```json
{
  "candidateId": "{{candidateA}}"
}
```

Expected:

- `data.agora.token` is the Agora RTC token
- client joins Agora using `appId`, `channelName`, `token`, and `uid`

### 5. Consultant joins the meeting

```http
POST {{baseUrl}}/meeting-schedules/{{meetingId}}/join
Authorization: Bearer {{consultantToken}}
Content-Type: application/json
```

Body: empty `{}`

### 6. Reschedule request

```http
PATCH {{baseUrl}}/meeting-schedules/{{meetingId}}/reschedule
Authorization: Bearer {{tokenA}}
Content-Type: application/json
```

Body:

```json
{
  "requestedTimeSlots": ["2026-06-03T09:00:00.000Z"],
  "note": "Can we move to Thursday?"
}
```

---

## Maintenance Note

If you add a new mounted module or change a route, update this README in the same PR so frontend and backend stay in sync.
