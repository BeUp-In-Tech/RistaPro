# Document Module API

Base path: `/api/v1/documents`

This module handles candidate identity/education document uploads, face verification, and parent/guardian document verification. Documents go through an admin review workflow (PENDING → APPROVED or REJECTED).

## Security Rules

- All endpoints require `Authorization: Bearer <accessToken>`.
- Upload and verification endpoints are for `USER` and `ADMIN` roles.
- Approve/reject endpoints are for `ADMIN` only.

---

## Document Types

| Type           | Description                                         |
|----------------|-----------------------------------------------------|
| `ID`           | National ID, passport, or other identity document   |
| `EDUCATION`    | Degree certificate, transcript, etc.                |
| `PARENT_PHOTO` | A photo of the parent/guardian                      |
| `PARENT_ID`    | Parent/guardian identity document                   |
| `FACE`         | Face verification record                            |

---

## Face Verification

### `POST /face-verification`

Records the result of a face verification check for the candidate.

Auth: `USER`, `ADMIN`

Body:

```json
{
  "candidateId": "candidateId",
  "isFaceVerified": true
}
```

---

## Parent / Guardian Documents

### `POST /parent/photo`

Uploads a photo of the parent or guardian.

Auth: `USER`, `ADMIN`

Content-Type: `multipart/form-data`

| Field        | Type   | Required | Description             |
|--------------|--------|----------|-------------------------|
| `photo`      | File   | Yes      | Image file of the parent |
| `candidateId`| Text   | Yes      | The candidate's ID       |

### `POST /parent/face-verification`

Records the result of a parent face verification check.

Auth: `USER`, `ADMIN`

Body:

```json
{
  "candidateId": "candidateId",
  "isFaceVerified": true
}
```

### `POST /parent/id-card`

Uploads parent/guardian ID documents (max 2 files).

Auth: `USER`, `ADMIN`

Content-Type: `multipart/form-data`

| Field        | Type         | Required | Description                                           |
|--------------|--------------|----------|-------------------------------------------------------|
| `documents`  | File (×1–2)  | Yes      | ID document files                                     |
| `candidateId`| Text         | Yes      | The candidate's ID                                    |
| `title`      | Text         | No       | Single title (if uploading one file)                  |
| `titles`     | Text (JSON)  | No       | JSON array of titles e.g. `["Front","Back"]`          |

---

## Candidate Documents

### `POST /upload`

Uploads identity or education documents for the candidate (max 10 files).

Auth: `USER`, `ADMIN`

Content-Type: `multipart/form-data`

| Field        | Type           | Required | Description                                          |
|--------------|----------------|----------|------------------------------------------------------|
| `documents`  | File (×1–10)   | Yes      | Document files                                       |
| `candidateId`| Text           | Yes      | The candidate's ID                                   |
| `type`       | Text           | Yes      | `ID` or `EDUCATION`                                  |
| `title`      | Text           | No       | Single title                                         |
| `titles`     | Text (JSON)    | No       | JSON array of titles matching the number of files    |

Documents are created with `verification_status: PENDING` and must be reviewed by an admin.

### `GET /:candidateId`

Returns all documents for a candidate.

Auth: `USER`, `ADMIN`

Response:

```json
[
  {
    "_id": "documentId",
    "candidate": "candidateId",
    "type": "ID",
    "verification_status": "PENDING",
    "documents": [
      { "file": "https://res.cloudinary.com/...", "title": "Passport" }
    ],
    "rejected_reason": null
  }
]
```

---

## Admin Review

### `PATCH /:documentId/approve`

Approves a submitted document.

Auth: `ADMIN`

No body required.

### `PATCH /:documentId/reject`

Rejects a submitted document with a reason.

Auth: `ADMIN`

Body:

```json
{
  "rejected_reason": "Document is blurry or illegible"
}
```

---

## Verification Status Values

| Status     | Description                            |
|------------|----------------------------------------|
| `NONE`     | No document submitted yet              |
| `PENDING`  | Uploaded, awaiting admin review        |
| `APPROVED` | Admin approved the document            |
| `REJECTED` | Admin rejected — reason provided       |
