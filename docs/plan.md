# Plan Module

Base path: `/api/v1/plans`

Manages the Free, Gold, and Platinum plan configurations that control feature access across the app.

---

## Plan Keys

| Key | Description |
|-----|-------------|
| `free` | Free tier — basic swipe/match access |
| `gold` | Gold tier — unlocks received likes, full profile view |
| `platinum` | Platinum tier — unlocks messaging, calls, consultant access |

---

## Endpoints

### `GET /`

List all plans.

**Auth:** Public

---

### `GET /:planType`

Get a single plan by key.

**Auth:** Public

**Params:** `planType` — `free`, `gold`, or `platinum`

---

### `POST /`

Create a plan configuration.

**Auth:** `ADMIN` only

**Body:**
```json
{
  "planType": "gold",
  "price": 19.99
}
```

**Rules:**
- `free` must have `price = 0`
- Paid plans must have `price > 0`

---

### `PATCH /:planType`

Update a plan configuration.

**Auth:** `ADMIN` only

**Params:** `planType` — `free`, `gold`, or `platinum`

**Body:**
```json
{
  "price": 29.99,
  "isActive": true
}
```

**Notes:**
- Plan values come from the active plan document in MongoDB.
- Changing `plan.constant.ts` updates future create/update payloads, but existing plan documents must be updated via this API or a migration.
