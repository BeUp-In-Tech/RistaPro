# Auth Module

Base path: `/api/v1/auth`

Handles Google OAuth, credential login, password management, and token rotation.

---

## Auth Rules

- Public endpoints need no authorization header.
- Protected endpoints require `Authorization: Bearer <accessToken>`.
- The `refreshToken` is stored in an HTTP-only cookie and used by `GET /get_new_access_token`.

---

## Endpoints

### `GET /google`

Start Google OAuth login.

**Auth:** Public

**Query:**
- `redirect` — optional frontend path or state value

**Notes:**
- Open this URL in a browser or mobile webview to begin the OAuth flow.

---

### `GET /google/callback`

OAuth redirect callback from Google.

**Auth:** Public

**Behavior:**
- Creates user automatically if not found.
- Sets auth cookies.
- Redirects to frontend or deep link with token.

---

### `POST /google/auth`

Authenticate with a Google ID token (for native iOS/Android apps that cannot use the browser OAuth redirect).

**Auth:** Public

**Body:**
```json
{
  "idToken": "google-id-token-from-firebase-or-google-sign-in-sdk"
}
```

**Behavior:**
- Verifies the Google ID token using Firebase Admin.
- Creates the user automatically if not found.
- Returns `accessToken` in the response body and sets the refresh token cookie.
- Use this route instead of `GET /google` for native apps.

---

### `POST /login`

Login with email and password.

**Auth:** Public

**Body:**
```json
{
  "email": "consultant@example.com",
  "password": "StrongPass1!"
}
```

**Notes:**
- Intended for consultant or admin accounts that have a password set.

---

### `PATCH /change_password`

Change password for the logged-in user.

**Auth:** Bearer token (any role)

**Body:**
```json
{
  "oldPassword": "OldPass1!",
  "newPassword": "NewPass1!"
}
```

---

### `POST /forget_password`

Request a password reset OTP.

**Auth:** Public

**Body:**
```json
{
  "email": "consultant@example.com"
}
```

---

### `POST /verify_forget_password_otp`

Verify the reset OTP and receive a one-time reset token.

**Auth:** Public

**Body:**
```json
{
  "email": "consultant@example.com",
  "otp": "123456"
}
```

**Response data shape:**
```json
{
  "token": "otp-verification-token"
}
```

---

### `POST /reset_password`

Reset the password after OTP verification.

**Auth:** Public (OTP token in header)

**Headers:**
- `token: <otp-verification-token>`

**Body:**
```json
{
  "newPassword": "NewPass1!"
}
```

---

### `GET /get_new_access_token`

Rotate the access and refresh tokens.

**Auth:** Refresh cookie must exist

**Notes:**
- Reads the refresh token from the `refreshToken` HTTP-only cookie.
- Rotates the refresh token cookie.
- Returns the new access token in the response body.

**Example:**
```http
GET /api/v1/auth/get_new_access_token
Cookie: refreshToken=<refreshToken>
```

**Response data shape:**
```json
{
  "accessToken": "new access token"
}
```
