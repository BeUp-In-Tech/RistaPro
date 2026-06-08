# User Module

Base path: `/api/v1/users`

Handles user profile management, device token registration, and admin user management.

---

## Authenticated User Endpoints

### `GET /me`

Get the logged-in user profile plus app context for frontend gating.

**Auth:** Bearer token

**Response includes:**
- Top-level user fields: `_id`, `full_name`, `email`, `picture`, `plan`, `isVerified`, `isActive`, `role`
- `candidateLink`: whether this account is linked to a candidate profile
- `permissions`: frontend-friendly booleans for feature gating

**Response data shape:**
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

**Notes:**
- Use `permissions` for broad UI gating.
- The swipe action API is the source of truth for quota counts — `GET /me` does not expose raw quota counters.

---

### `PATCH /me`

Update the logged-in user's profile.

**Auth:** Bearer token

**Content-Type:** `application/json` or `multipart/form-data`

**Allowed fields:** `full_name`, `picture`

**Multipart file field:** `file`

**Body:**
```json
{
  "full_name": "Nayem Ahmed"
}
```

---

### `POST /me/send_verification_otp`

Send a profile verification OTP to the user's email.

**Auth:** Bearer token

---

### `POST /me/verify_profile`

Verify the user profile with an OTP.

**Auth:** Bearer token

**Body:**
```json
{
  "otp": "123456"
}
```

---

### `GET /devices`

List the logged-in user's registered devices.

**Auth:** Bearer token

---

### `POST /devices`

Register an FCM device token for push notifications.

**Auth:** Bearer token

**Body:**
```json
{
  "token": "firebase-device-token",
  "platform": "ANDROID",
  "deviceId": "device-123",
  "deviceName": "Pixel 8"
}
```

**Allowed `platform` values:** `WEB`, `IOS`, `ANDROID`

---

### `PATCH /devices/:deviceId/inactive`

Deactivate a registered device token.

**Auth:** Bearer token

---

## Admin Endpoints

### `POST /`

Create a consultant account.

**Auth:** `ADMIN` only

**Body:**
```json
{
  "full_name": "Consultant One",
  "email": "consultant@example.com",
  "password": "StrongPass1!"
}
```

**Validation:**
- `full_name`: 3–100 chars
- `email`: valid email
- `password`: min 6 chars, at least 1 uppercase, 1 number, 1 special char

---

### `GET /`

List users.

**Auth:** `ADMIN` only

**Query params:** `page`, `limit`, `sort`, `fields`, `searchTerm`, direct field filters (`role`, `isActive`, `isVerified`)

---

### `GET /:id`

Get a single user by ID.

**Auth:** `ADMIN` only

---

### `PATCH /:id`

Update a user by admin.

**Auth:** `ADMIN` only

**Content-Type:** `application/json` or `multipart/form-data`

**Allowed fields:** `full_name`, `picture`, `plan`, `isVerified`, `isActive`

**Multipart file field:** `file`

---

### `DELETE /:id`

Soft-delete a user.

**Auth:** `ADMIN` only

**Notes:** Admin cannot delete their own account from this route.
