# Modified API List

This file summarizes APIs changed during the constants, nested candidate identity, preference, swipe, and match updates.

## Candidate APIs

Base path: `/api/v1/candidates`

### `GET /constants`

- Added `religionTree` for cascading religious UI.
- Added `casteTree` for cascading caste UI.
- Removed legacy flat caste groups such as `castes`, `lineages`, and `tribes`.
- `casteTree` is now the caste/biradari/tribe source of truth.

Main files:
- `src/app/modules/candidate/constant/candidate.constant.service.ts`
- `src/app/constant/religion.constant.ts`
- `src/app/constant/caste.constant.ts`
- `docs/candidate.md`

### `POST /`

- Candidate create now supports nested identity payloads:
  - `religious`
  - `casteIdentity`
- Caste identity must use `casteIdentity`; flat caste fields are no longer accepted.

Main files:
- `src/app/modules/candidate/candidate.model.ts`
- `src/app/modules/candidate/candidate.validate.ts`
- `src/app/modules/candidate/candidate.utility.ts`
- `src/app/modules/candidate/candidate.service.ts`
- `docs/candidate.md`

### `PATCH /:candidateId`

- Candidate update now supports partial nested identity updates.
- Example: `{ "religious": { "sect": "SUNNI" } }`
- Caste update fields must be sent under `casteIdentity`.

Main files:
- `src/app/modules/candidate/candidate.validate.ts`
- `src/app/modules/candidate/candidate.utility.ts`
- `src/app/modules/candidate/candidate.service.ts`
- `docs/candidate.md`

### `GET /my_full_profile`

- Full profile responses now include:
  - `religious`
  - `casteIdentity`
  - nested labels under `labels.religious` and `labels.casteIdentity`
- Caste flat aliases are no longer returned.

Main files:
- `src/app/modules/candidate/candidate.service.ts`
- `src/app/modules/candidate/candidate.utility.ts`
- `docs/candidate.md`

### `GET /:targetCandidateId/full_profile`

- Same nested identity and nested label response updates as `GET /my_full_profile`.

Main files:
- `src/app/modules/candidate/candidate.service.ts`
- `src/app/modules/candidate/candidate.utility.ts`
- `docs/candidate.md`

### `GET /my_linked_profiles`

- Linked candidate population now selects `religious` and `casteIdentity`.

Main files:
- `src/app/modules/candidate/linked-user/candidateLinkedUser.helper.ts`
- `docs/candidate.md`

### `POST /admin/migrate-legacy-taxonomy`

- Added admin migration endpoint.
- Supports `dryRun=true`.
- Copies old flat candidate identity fields into:
  - `religious`
  - `casteIdentity`
- Also augments old preference values for compatibility.

Main files:
- `src/app/modules/candidate/candidate.routes.ts`
- `src/app/modules/candidate/candidate.controller.ts`
- `src/app/modules/candidate/candidate.service.ts`
- `docs/candidate.md`

## Candidate Preference APIs

Base path: `/api/v1/candidate-preferences`

### `GET /:candidateId`

- Response can include newer preference arrays:
  - `casteCategories`
  - `clans`
  - `movements`
- Preference matching now targets nested candidate identity fields.

Main files:
- `src/app/modules/candidate-preference/candidatePreference.helper.ts`
- `src/app/modules/candidate-preference/candidatePreference.model.ts`
- `docs/candidate-preference.md`

### `PUT /:candidateId`

- Accepts new preference arrays:
  - `casteCategories`
  - `clans`
  - `movements`
- Accepts strict filters:
  - `casteCategory`
  - `clan`
  - `movement`

Main files:
- `src/app/modules/candidate-preference/candidatePreference.interface.ts`
- `src/app/modules/candidate-preference/candidatePreference.model.ts`
- `src/app/modules/candidate-preference/candidatePreference.validate.ts`
- `src/app/modules/candidate-preference/candidatePreference.utility.ts`
- `docs/candidate-preference.md`

### `PATCH /:candidateId`

- Same new fields as `PUT`.
- Partial updates only touch sent fields.

Main files:
- `src/app/modules/candidate-preference/candidatePreference.validate.ts`
- `src/app/modules/candidate-preference/candidatePreference.utility.ts`
- `docs/candidate-preference.md`

## Swipe APIs

Base path: `/api/v1/swipes`

### `GET /feed`

- Feed scoring now reads nested candidate fields:
  - `religious.*`
  - `casteIdentity.*`
- Strict caste filters query nested `casteIdentity` paths.
- Feed card labels now include nested identity labels.
- Feed cards no longer return the deprecated top-level `religion` alias or
  flat religious label aliases; use `labels.religious.*` instead.

Main files:
- `src/app/modules/swipe/swipe.helper.ts`
- `src/app/modules/swipe/swipe.interface.ts`
- `docs/swipe.md`
- `docs/swipes.md`

### `GET /nearby-matches`

- Nearby matching uses the same nested identity matching as feed.
- Nearby cards include nested labels through the shared card builder.

Main files:
- `src/app/modules/swipe/swipe.helper.ts`
- `src/app/modules/swipe/swipe.interface.ts`
- `docs/swipe.md`

## Match APIs

Base path: `/api/v1/matches`

### `GET /`

- Match candidate summary now reads religion from `religious.religion`.
- Falls back to old flat `religion` during migration.

Main files:
- `src/app/modules/match/match.helper.ts`
- `src/app/modules/match/match.interface.ts`
- `docs/matches.md`

### `GET /:matchId`

- Same match candidate summary update as `GET /`.

Main files:
- `src/app/modules/match/match.helper.ts`
- `src/app/modules/match/match.interface.ts`
- `docs/matches.md`

## UI Example

### Standalone constants UI example

- Shows how to render cascading dropdowns from `religionTree` and `casteTree`.
- Generates nested candidate payload:
  - `religious`
  - `casteIdentity`

Main file:
- `docs/candidate-constants-ui-example.html`
