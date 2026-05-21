# RistaPro Swipe System Architecture

Status: proposal for review.

This document plans the Tinder-style matrimony discovery system for RishtaPro. The product wording can say "swap" if desired, but the backend should use "swipe" because the domain action is like, pass, or super like on a candidate profile.

No implementation code is included in this document. After this architecture is reviewed and finalized, the code should be added in small phases.

## Product Goal

RistaPro should show each candidate a relevant feed of other candidate profiles based on partner preferences. A candidate or an authorized linked user can like, super like, or pass a profile. If two candidates like each other, the system creates a match/connect and opens a conversation. A candidate can also send a first message to another candidate without a match; that first message is treated as a message request, and the chat opens only if the opposite side accepts. Paid plans control messaging, audio call, video call, super likes, and "see who liked me".

## Existing Project Context

The existing backend already has most core concepts:

- `Candidate` is the matchmaking identity.
- `User` is the login/account identity.
- `CandidateLinkedUser` controls which users can manage a candidate profile.
- `Like` already supports `LIKE`, `SUPER_LIKE`, and `PASS`.
- `Match` stores two connected candidates.
- `Conversation` and `Message` are already modeled for chat.
- `Call` already stores audio/video calls.
- `Plan` already defines paid feature flags:
  - `dailyLikes`
  - `superLikes`
  - `canSeeWhoLiked`
  - `canMessage`
  - `canAudioCall`
  - `canVideoCall`
  - `canViewFullProfile`
  - `profileBoost`
- `User` stores the selected `plan`. Like and super-like remaining counts are derived from `Like` action history for the current quota window rather than stored directly on the user.

The final architecture should reuse these instead of creating a separate matching identity.

## Main Design Decision

All swipe, like, match, chat, and call records should be candidate-to-candidate, not user-to-user.

Reason:

- One candidate profile can be managed by linked users.
- A father, mother, guardian, consultant, or candidate may act on behalf of the candidate.
- Matches and conversations belong to candidate profiles, regardless of which linked user performed the action.

The authenticated `User` still matters for:

- permission checks
- plan/quota checks
- audit fields such as `actedBy`
- notification delivery to linked users

## Proposed Modules

Add or extend these modules:

```txt
src/app/modules/candidate-preference/
  candidatePreference.interface.ts
  candidatePreference.model.ts
  candidatePreference.validate.ts
  candidatePreference.service.ts
  candidatePreference.controller.ts
  candidatePreference.routes.ts

src/app/modules/swipe/
  swipe.interface.ts
  swipe.validate.ts
  swipe.service.ts
  swipe.controller.ts
  swipe.routes.ts
  swipe.utility.ts

src/app/modules/match/
  extend current match model/service/controller/routes

src/app/modules/conversation/
  extend current conversation model/service/controller/routes
  add message request support for starting chat without a match
  add guardian/parent chat involvement request and participant controls

src/app/modules/message/
  enforce paid access before sending messages or message requests
  track the authenticated linked user who sent each message

src/app/modules/call/
  enforce paid access before starting audio/video calls

src/app/modules/rishta_progress/
  track pair progress across match, chat, parent involvement, and marriage approval
  add marriage request approval workflow for candidate owners and consultants

src/app/modules/notification/
  persist notification rows and send Firebase push through BullMQ

src/app/utils/planAccess.ts
  reusable helpers for plan flags and quota reset
```

The `like` module can either be renamed to `swipe` later, or kept as the database model behind the swipe API. For minimum disruption, keep the existing `Like` model and let the new `swipe` service use it internally.

## Data Model

### 1. CandidatePreference

Create one preference document per candidate.

```ts
interface ICandidatePreference {
  candidate: Types.ObjectId;

  preferredGenders: Gender[];

  ageMin?: number;
  ageMax?: number;

  heightMin?: number;
  heightMax?: number;

  religions?: ReligionKey[];
  sects?: SectKey[];
  castes?: CastKey[];

  relationship_statuses?: RelationshipStatusKey[];
  have_children?: ChildrenKey[];
  move_abroad?: MoveAbroadKey[];
  occupations?: OccupationKey[];
  highest_educations?: HighestEducationKey[];
  smoke_statuses?: SmokeStatusKey[];
  drink_statuses?: DrinkStatusKey[];

  interests?: InterestKey[];
  personality?: PersonalityKey[];

  maxDistanceKm?: number;

  strictFilters?: {
    gender?: boolean;
    age?: boolean;
    height?: boolean;
    religion?: boolean;
    caste?: boolean;
    location?: boolean;
  };

  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}
```

Recommended defaults:

- `preferredGenders` defaults to the opposite gender for `MALE` and `FEMALE`.
- `strictFilters.gender` should default to `true`.
- `strictFilters.age` should default to `true` if age values exist.
- Other filters should be soft by default so the feed does not become empty too quickly.

Index:

```ts
candidatePreferenceSchema.index({ candidate: 1 }, { unique: true });
```

### 2. Candidate

Keep the existing candidate profile as the searchable profile. Add indexes for feed performance.

Recommended indexes:

```ts
candidateSchema.index({ isActive: 1, gender: 1, dateOfBirth: 1 });
candidateSchema.index({ isActive: 1, religion: 1, sect: 1, caste: 1 });
candidateSchema.index({ isActive: 1, height: 1 });
candidateSchema.index({ isActive: 1, createdAt: -1 });
candidateSchema.index({ coordinates: '2dsphere' });
```

Important note: MongoDB `2dsphere` works best if `coordinates` is stored as GeoJSON. Current candidate `coordinates` is a number array. For MVP, keep it as `[longitude, latitude]`. For strong location matching, migrate later to:

```ts
location: {
  type: 'Point',
  coordinates: [longitude, latitude]
}
```

### 3. Like as SwipeAction

Reuse the existing `Like` model, but make it stricter and more useful.

Current fields:

```ts
likedBy: Candidate
likedProfile: Candidate
type: LIKE | SUPER_LIKE | PASS
```

Recommended additions:

```ts
actedBy: User;          // authenticated user who performed the action
source: 'FEED' | 'LIKES_ME' | 'PROFILE';
isActive: boolean;      // future support for undo or reset
```

Recommended indexes:

```ts
likeSchema.index({ likedBy: 1, likedProfile: 1 }, { unique: true });
likeSchema.index({ likedProfile: 1, type: 1, createdAt: -1 });
likeSchema.index({ likedBy: 1, type: 1, createdAt: -1 });
```

Behavior:

- A candidate can only have one active action toward another candidate.
- `LIKE` and `SUPER_LIKE` can create a match if the other candidate already liked back.
- `PASS` hides the target from the feed.
- `PASS` should not consume paid quota.
- `LIKE` consumes one daily like.
- `SUPER_LIKE` consumes one super like.
- Once matched, changing action should not silently remove the match. Unmatch should be a separate explicit action.

### 4. Match

Extend the existing `Match` model.

Recommended fields:

```ts
interface IMatch {
  candidates: [Types.ObjectId, Types.ObjectId];
  pairKey: string;
  status: 'ACTIVE' | 'UNMATCHED' | 'BLOCKED';
  matchedBy?: Types.ObjectId;     // candidate that completed the mutual like
  conversation?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}
```

`pairKey` should be built by sorting the two candidate ids:

```txt
candidateA_candidateB
```

Index:

```ts
matchSchema.index({ pairKey: 1 }, { unique: true });
matchSchema.index({ candidates: 1, status: 1, updatedAt: -1 });
```

### 5. Conversation

Extend the existing `Conversation` model so every active match can have one conversation, and every accepted unmatched message request can open one conversation.

Recommended additions:

```ts
match?: Types.ObjectId;
messageRequest?: Types.ObjectId;
pairKey: string;
source: 'MATCH' | 'MESSAGE_REQUEST';
status: 'OPEN' | 'ARCHIVED' | 'BLOCKED';
parentInvolvement: boolean;
guardianParticipants: {
  candidate: Types.ObjectId;      // candidate profile represented by this guardian
  linkedUser: Types.ObjectId;     // CandidateLinkedUser record
  user: Types.ObjectId;           // authenticated user account
  addedBy: Types.ObjectId;        // owner user who added this guardian
  addedAt: Date;
  removedBy?: Types.ObjectId;     // owner user who removed this guardian
  removedAt?: Date;
  isActive: boolean;
}[];
```

Index:

```ts
conversationSchema.index({ match: 1 }, { unique: true, sparse: true });
conversationSchema.index({ messageRequest: 1 }, { unique: true, sparse: true });
conversationSchema.index({ pairKey: 1 }, { unique: true });
conversationSchema.index({ participants: 1, status: 1, updatedAt: -1 });
conversationSchema.index({ 'guardianParticipants.user': 1, status: 1 });
```

Conversation creation rules:

- A mutual like creates or returns an open `MATCH` conversation.
- An accepted message request creates or returns an open `MESSAGE_REQUEST` conversation.
- `pairKey` stays unique so the same two candidates do not get multiple chat windows.
- If a match is created later for candidates who already have an accepted message-request conversation, reuse that existing conversation and attach the `match` id to it.

### 5A. ConversationMessageRequest

Create a request document when one side sends the first message before both candidates are matched.

Reason:

- A candidate should be able to start contact without waiting for a mutual match.
- The first unmatched message should not immediately open a full chat window for the target side.
- The target side must accept the request before the conversation becomes an open chat.
- Acceptance opens the same conversation thread; it must not create a fake match.

Recommended fields:

```ts
interface IConversationMessageRequest {
  pairKey: string;

  requesterCandidate: Types.ObjectId;
  requesterUser: Types.ObjectId;

  targetCandidate: Types.ObjectId;
  targetRespondedBy?: Types.ObjectId;

  firstMessage: string;
  conversation?: Types.ObjectId;

  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  respondedAt?: Date;
  expiresAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}
```

Indexes:

```ts
conversationMessageRequestSchema.index({
  requesterCandidate: 1,
  targetCandidate: 1,
  status: 1,
}, {
  unique: true,
  partialFilterExpression: { status: 'PENDING' },
});
conversationMessageRequestSchema.index({ targetCandidate: 1, status: 1, createdAt: -1 });
conversationMessageRequestSchema.index({ pairKey: 1, status: 1, createdAt: -1 });
```

Behavior:

- `OWNER` and `EDITOR` users can send a message request on behalf of a candidate if messaging is allowed by plan.
- `VIEWER` users cannot send message requests.
- Only one active `PENDING` message request should exist for the same requester/target pair.
- If an open conversation already exists for the same `pairKey`, send the message directly to that conversation instead of creating a request.
- When the target accepts, create or return the conversation, insert the first message into that conversation, and mark the request `ACCEPTED`.
- When the target rejects, keep the request for audit but do not create a conversation.
- Message requests should be visible in a separate inbox/request list, similar to Microsoft Teams chat requests.

### 6. ConversationGuardianRequest

Create a request document when one side wants to involve parents or guardians in the same open conversation.

Reason:

- A candidate owner should not be able to add parents or guardians into a private chat without the opposite side approving it first.
- Approval should be per conversation, not global across every future match.
- The request should name the active linked users the requester wants to involve.
- When the opposite side accepts, the approved linked users should be added directly into the same existing conversation.
- Acceptance must not create a separate guardian chat or a new match.

Recommended fields:

```ts
interface IConversationGuardianRequest {
  conversation: Types.ObjectId;
  match?: Types.ObjectId;
  pairKey: string;

  requesterCandidate: Types.ObjectId;
  requesterUser: Types.ObjectId;

  requestedGuardians: {
    linkedUser: Types.ObjectId;     // CandidateLinkedUser requested for this chat
    user: Types.ObjectId;           // authenticated user account behind that linked user
  }[];

  targetCandidate: Types.ObjectId;
  targetRespondedBy?: Types.ObjectId;

  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  message?: string;
  respondedAt?: Date;
  expiresAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}
```

Indexes:

```ts
conversationGuardianRequestSchema.index({
  conversation: 1,
  requesterCandidate: 1,
  targetCandidate: 1,
  status: 1,
});
conversationGuardianRequestSchema.index({ targetCandidate: 1, status: 1, createdAt: -1 });
```

Behavior:

- Only one active `PENDING` request should exist for the same conversation/requester/target pair.
- The create request endpoint should receive the linked user ids that the requester wants to include in the chat.
- Once accepted, the accept handler should add those requested guardians into `Conversation.guardianParticipants` for the same conversation, preferably in the same database transaction that marks the request `ACCEPTED`.
- Before adding guardians, validate that every requested linked user is still active and belongs to the requester candidate.
- The separate add-guardian endpoint can be kept for adding more guardians later after approval, but the first approved guardians should be included immediately on accept.
- Rejection means no guardian can be added by that requester unless a new request is sent later.
- Cancelling is optional for MVP, but useful if the requester changes their mind.

### 7. Message

Extend the existing `Message` model so the conversation remains tied to the candidate pair while the chat UI can behave like a group chat with candidate owners and approved guardians.

Recommended additions:

```ts
sender: Types.ObjectId;          // candidate represented in the chat
sentBy: Types.ObjectId;          // authenticated user who typed/sent it
sentByLinkedUser?: Types.ObjectId;
```

Behavior:

- Candidate owners and editors send messages on behalf of the candidate.
- Approved guardians added to the conversation can also send messages in the same chat on behalf of their represented candidate.
- Added guardians can send only while their `guardianParticipants.isActive` record is true and their linked-user access role allows chat mutation.
- Viewer guardians can read the conversation if added, but cannot send messages.
- Every message must store both the represented candidate in `sender` and the real authenticated user in `sentBy`, so the UI can show who actually wrote each group-chat message.

### 8. RishtaProgress and Marriage Approval

Track one progress row per candidate pair.

Recommended fields:

```ts
interface IRishtaProgress {
  candidates: [Types.ObjectId, Types.ObjectId];
  pairKey: string;
  match?: Types.ObjectId;
  conversation?: Types.ObjectId;
  completedSteps: ('MATCHES' | 'START_CHAT' | 'PARENT_INVOLVES' | 'SHAADI')[];
  progressValue: number;
  status: 'ACTIVE' | 'MARRIED';
  stepDetails: {
    step: string;
    completedAt: Date;
    source: string;
    referenceId?: Types.ObjectId;
    completedBy?: Types.ObjectId;
  }[];
  marriedAt?: Date;
  marriageConfirmedBy?: Types.ObjectId;
  consultantUser?: Types.ObjectId;
}
```

Recommended indexes:

```ts
rishtaProgressSchema.index({ pairKey: 1 }, { unique: true });
rishtaProgressSchema.index({ candidates: 1, status: 1, updatedAt: -1 });
rishtaProgressSchema.index({ status: 1, marriedAt: -1 });
rishtaProgressSchema.index({ consultantUser: 1, status: 1, marriedAt: -1 });
```

Automatic step rules:

- `MATCHES`: mutual swipe creates or returns an active match.
- `START_CHAT`: match chat starts, a message is sent, or a message request is accepted.
- `PARENT_INVOLVES`: accepted guardian request adds a parent/family/guardian linked user to the conversation. Consultant inclusion does not count as parent involvement.
- `SHAADI`: marriage request is fully accepted, or admin directly confirms the couple.

Create a separate marriage request collection:

```ts
interface IRishtaMarriageRequest {
  pairKey: string;
  candidates: [Types.ObjectId, Types.ObjectId];
  progress: Types.ObjectId;
  requestedByUser: Types.ObjectId;
  requestedByRole: 'USER' | 'CONSULTANT';
  requestedByCandidate?: Types.ObjectId;
  requestedByLinkedUser?: Types.ObjectId;
  consultantUser?: Types.ObjectId;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  approvals: {
    candidate: Types.ObjectId;
    user: Types.ObjectId;
    linkedUser?: Types.ObjectId;
    respondedAt: Date;
  }[];
  rejectedByCandidate?: Types.ObjectId;
  rejectedByUser?: Types.ObjectId;
  rejectedAt?: Date;
  rejectReason?: string;
}
```

Approval behavior:

- Candidate owner request auto-approves the requester candidate side and notifies the opposite candidate owners.
- Opposite candidate owner must accept before the couple becomes married.
- Consultant request notifies both candidate owner sides and requires both sides to accept.
- Consultant can create the request only when actively linked as `CONSULTANT` to at least one candidate in the pair.
- Admin direct confirmation skips the approval request, completes all steps, and cancels pending marriage requests for the pair.
- Direct marriage confirmation without an existing match/chat is allowed; the progress row is created and all steps are completed for UI consistency.
- Once married, both candidate ids are excluded from swipe feed and cannot perform new swipe actions.

### 9. CandidateInteractionState

Do not create this as a collection for MVP.

The feed can derive state from:

- Like records
- Match records
- Report/block records when those modules are implemented

If performance becomes a problem, create a denormalized interaction collection later.

## Permission Rules

The swipe APIs must use existing linked-user access.

Recommended rules:

- `OWNER`: can view feed, like, super like, pass, message, call if plan allows.
- `EDITOR`: can view feed, like, super like, pass, message, call if plan allows.
- `VIEWER`: can view feed only. Cannot like, pass, message, or call.
- `OWNER` and `EDITOR` can send a first-message request to an unmatched candidate if plan access allows messaging.
- `OWNER` and `EDITOR` can accept or reject message requests sent to their candidate.
- Only `OWNER` can request parent/guardian involvement in a chat.
- Only an `OWNER` of the opposite candidate can accept or reject parent/guardian involvement.
- The request must include selected active linked users from the requester candidate profile; after approval, those linked users are added directly into that same conversation.
- Added `OWNER` or `EDITOR` guardians can send messages if plan access allows messaging.
- Added `VIEWER` guardians can read the conversation only.
- The candidate `OWNER` who added guardians can remove those guardians from the conversation at any time.
- Unlinked users cannot access the candidate feed.
- A user linked to another active candidate cannot act for this candidate unless access rules allow it.
- Only candidate `OWNER` users can accept or reject marriage requests for their candidate side.
- A candidate owner can create a marriage request for their pair; their own side is auto-approved.
- A `CONSULTANT` user can create a marriage request only when linked as consultant to at least one candidate in the pair.
- `ADMIN` can directly mark a pair married.
- Married candidates cannot appear in discovery or perform new swipe actions.

Use the existing helper:

```ts
getActiveLinkedUserAccessOrThrow({
  candidateId,
  userId,
})
```

For mutation actions, reject `VIEWER`.

## Plan and Quota Rules

Use the candidate primary owner's `User.plan` to load the plan document.

Daily normal likes should be controlled by the plan template. The current free default is 100 per day.

Daily like quota should reset at a fixed product time every day, not 24 hours after the last like. For MVP, perform this reset lazily when a like action is attempted.

Plan templates should set numeric `dailyLikes` values for normal likes. Paid plans can differ by daily likes, super likes, and unlocked features.

Recommended default:

```txt
Daily like reset time: 00:00 Asia/Dhaka
Daily normal like limit: plan.dailyLikes
```

If the product later needs a different reset hour, make it configurable:

```txt
LIKE_QUOTA_RESET_TIME=00:00
LIKE_QUOTA_RESET_TIMEZONE=Asia/Dhaka
```

Suggested helper:

```ts
getCandidatePlanOwnerOrThrow(candidateId)
getUserPlanOrDefault(planOwnerUserId)
getCurrentLikeQuotaWindow(now)
getNextLikeQuotaResetAt(now)
assertCanUseSwipeAction(user, plan, actionType)
getSwipeQuotaUsage(candidateId, quotaWindow)
assertCanMessage(user, plan)
assertCanCall(user, plan, callType)
assertCanSeeWhoLiked(user, plan)
assertCanViewFullProfile(user, plan)
```

Rules:

- `PASS`: free, does not consume quota.
- `LIKE`: requires current-window `LIKE` count for the acting candidate to be below `plan.dailyLikes`.
- `SUPER_LIKE`: requires current-window `SUPER_LIKE` count for the acting candidate to be below `plan.superLikes`.
- `likes-me` list requires `plan.canSeeWhoLiked`.
- Sending message requests and messages requires `plan.canMessage`.
- Starting audio calls requires `plan.canAudioCall`.
- Starting video calls requires `plan.canVideoCall`.
- Viewing full candidate profile details requires `plan.canViewFullProfile`. Free feed cards stay limited; Gold and Platinum can unlock full profile details.
- Creating a match or receiving a message request should not require paid plan. Paid plan controls who can initiate paid actions such as sending messages, calls, and first-message requests.

## Swipe Feed Algorithm

Endpoint:

```txt
GET /api/v1/swipes/feed?candidateId=<candidateId>&limit=20&cursor=<cursor>
```

High-level flow:

1. Authenticate user.
2. Verify the user has active access to the candidate.
3. Load candidate profile.
4. Load candidate preferences.
5. Build exclusion ids:
   - own candidate id
   - candidates already liked, super liked, or passed by this candidate
   - active matches
   - candidates in `MARRIED` rishta progress rows
   - blocked/reported candidates when those modules exist
6. Build MongoDB base query:
   - `isActive: ACTIVE`
   - target candidate is not self
   - gender/age hard filters
   - optional strict filters from preferences
7. Fetch more than needed, for example `limit * 3`.
8. Score candidates in service layer.
9. Sort by score, profile boost, and freshness.
10. Return exactly `limit` cards.

### Hard Filters

Always apply:

- active candidate only
- target is not self
- target does not already have an action from this candidate
- target is not already matched with this candidate
- gender preference, if present
- age range, if present and marked strict

Conditionally apply if preference marks them strict:

- religion
- caste
- height
- location distance

### Soft Score

Use soft scoring for optional fields so the feed remains populated.

Example scoring:

```txt
base score: 0
+30 gender match
+25 age range match
+15 religion match
+10 sect match
+8 caste match
+8 height range match
+10 same highest education
+8 occupation match
+5 relationship status match
+5 children preference match
+5 move abroad match
+4 smoke status match
+4 drink status match
+2 per shared interest, max 12
+2 per shared personality trait, max 12
+10 location within maxDistanceKm
+10 admin verified candidate
+8 profile has 3+ images
+5 profile has bio
+20 profile boost if plan supports it
-20 missing profile photo
```

This scoring can live in `swipe.utility.ts`.

### Empty Feed Fallback

If strict query returns too few results:

1. Keep gender and active status.
2. Keep age if provided.
3. Relax religion/caste/height/location.
4. Return lower-scoring candidates with a response flag:

```json
{
  "relaxed": true,
  "relaxedReason": "Not enough candidates matched all preferences"
}
```

### Cursor Strategy

For MVP, use cursor pagination with `createdAt` and `_id`.

Later, for better ranking stability, store a short feed session in Redis:

```txt
swipe_feed:<candidateId>:<hashOfPreference>:<sessionId>
```

TTL: 10 to 20 minutes.

## Swipe Action Algorithm

Endpoint:

```txt
POST /api/v1/swipes/action
```

Request:

```json
{
  "candidateId": "candidate id acting",
  "targetCandidateId": "candidate id being acted on",
  "type": "LIKE"
}
```

Supported `type` values:

- `LIKE`
- `SUPER_LIKE`
- `PASS`

High-level flow:

1. Authenticate user.
2. Verify candidate access.
3. Reject `VIEWER` access.
4. Reject self action.
5. Verify target candidate is active.
6. Reject action if either candidate is already married.
7. Reject action if an active match already exists.
8. Load the candidate owner's plan.
9. Count current-window `LIKE` and `SUPER_LIKE` actions for the acting candidate.
10. Validate quota for `LIKE` or `SUPER_LIKE`.
11. Upsert `Like` record for `(likedBy, likedProfile)`.
12. If action is `LIKE` or `SUPER_LIKE`, check reverse like:
    - reverse likedBy = target
    - reverse likedProfile = actor
    - reverse type in `LIKE`, `SUPER_LIKE`
13. If reverse like exists:
    - create or return existing `Match`
    - create or return existing `Conversation`; if an accepted message-request conversation already exists for this pair, attach the match to that conversation
    - complete `RishtaProgress.MATCHES`
    - send match notifications to linked users
    - return `matched: true`
14. If no reverse like:
    - return `matched: false`

Response:

```json
{
  "action": {
    "_id": "like id",
    "type": "LIKE",
    "likedBy": "candidate id",
    "likedProfile": "candidate id"
  },
  "matched": true,
  "match": {
    "_id": "match id",
    "candidates": ["candidate a", "candidate b"],
    "conversation": "conversation id"
  },
  "quota": {
    "dailyLikeRemaining": 4,
    "superLikeRemaining": 0,
    "nextResetAt": "date"
  }
}
```

## Likes Me

Endpoint:

```txt
GET /api/v1/swipes/likes-me?candidateId=<candidateId>&limit=20&cursor=<cursor>
```

Rules:

- Requires `plan.canSeeWhoLiked`.
- Shows candidates who liked this candidate.
- Exclude candidates already matched.
- Exclude candidates already passed by this candidate.
- Super likes should appear first.

Query:

```ts
Like.find({
  likedProfile: candidateId,
  type: { $in: [LIKE, SUPER_LIKE] },
})
```

## Matches

Recommended endpoints:

```txt
GET /api/v1/matches?candidateId=<candidateId>
GET /api/v1/matches/:matchId
PATCH /api/v1/matches/:matchId/unmatch
```

Rules:

- Only active linked users of a candidate in the match can read the match.
- Unmatch should mark match status as `UNMATCHED`.
- Conversation should be archived when a match is unmatched.

## Messaging

Message request flow, when no open conversation exists:

1. Authenticate user.
2. Resolve candidate access from `requesterCandidateId`.
3. Reject `VIEWER` access.
4. Check target candidate exists and is not the requester candidate.
5. Check no open conversation already exists for the same pair.
6. Check no active `PENDING` message request already exists from requester to target.
7. Load plan from authenticated user or the primary account, depending on business decision.
8. Require `plan.canMessage`.
9. Create `ConversationMessageRequest` with the first message text.
10. Notify the target candidate's active linked users that a message request is waiting.

Message request accept flow:

1. Authenticate user.
2. Resolve `OWNER` or `EDITOR` access for the target candidate.
3. Load the pending message request.
4. Create or return an open conversation for the request `pairKey` with `source: 'MESSAGE_REQUEST'`.
5. Insert the request's `firstMessage` into the conversation as the first `Message`.
6. Mark the request `ACCEPTED` and store `conversation`, `targetRespondedBy`, and `respondedAt`.
7. Notify the requester that the chat is open.

Message send flow:

1. Authenticate user.
2. Resolve candidate access from `candidateId`.
3. Check candidate belongs to the conversation.
4. Check conversation status is `OPEN`.
5. If `conversation.source === 'MATCH'`, check the linked match is still active.
6. If `conversation.source === 'MESSAGE_REQUEST'`, check the linked request was accepted.
7. Load plan from authenticated user or the primary account, depending on business decision.
8. Require `plan.canMessage`.
9. If the sender is a guardian participant, verify they were added to this conversation and `guardianParticipants.isActive` is true.
10. Create message with both `sender` candidate id and `sentBy` user id.
11. Update conversation last message and unread counts.
12. Notify all active conversation participants, including approved guardians.

Important product decision:

Paid permission can be based on either:

- the authenticated user sending the message
- the candidate owner's plan

Recommendation: use the candidate owner's plan for consistency. Linked users manage a candidate on behalf of that profile, so the candidate profile subscription should unlock actions.

## Guardian Involvement in Chat

This feature allows parents or guardians to join the same open conversation only after the opposite side agrees. The conversation may come from a mutual match or from an accepted message request. After guardians are added, the chat window should behave like a group chat for that conversation.

High-level flow:

1. Candidate A and Candidate B must already have an open conversation from either a mutual match or an accepted message request.
2. An `OWNER` of Candidate A sends a guardian involvement request for that conversation and selects the active linked users they want to include.
3. The request is delivered to the `OWNER` users of Candidate B.
4. An `OWNER` of Candidate B accepts or rejects the request.
5. If accepted, the system immediately adds the requested linked users from Candidate A's profile into that same conversation.
6. Added guardians can read and send messages in the same chat on behalf of Candidate A if their linked-user role allows messaging and messaging is unlocked by plan.
7. The chat UI shows candidate participants plus active guardian participants together, like a group chat.

Rules:

- Guardian involvement is per conversation.
- The opposite side must accept before any parent or guardian is added.
- Accepting a guardian involvement request directly adds the requested guardians to the existing conversation.
- The requesting side can add only its own active linked users.
- Added guardians do not create a new match or a new conversation.
- Message records must store `sentBy` so the system can audit whether the candidate, parent, guardian, or consultant sent the message.
- Either candidate owner can remove their own added guardians from the conversation at any time.
- Removing a guardian should set `guardianParticipants.isActive = false` and store `removedBy` and `removedAt`; it should not delete old messages.

Recommended endpoints:

```txt
POST   /api/v1/conversations/:conversationId/guardian-requests
GET    /api/v1/conversations/:conversationId/guardian-requests
PATCH  /api/v1/conversations/:conversationId/guardian-requests/:requestId/accept
PATCH  /api/v1/conversations/:conversationId/guardian-requests/:requestId/reject
POST   /api/v1/conversations/:conversationId/guardians
DELETE /api/v1/conversations/:conversationId/guardians/:linkedUserId
```

Route count: 6 guardian chat involvement routes.

## Rishta Progress and Marriage Approval

Progress is pair-level, not user-level. It should be updated by existing domain events instead of making the frontend manually advance steps.

Automatic progress updates:

1. Mutual swipe creates a match and completes `MATCHES`.
2. Match chat start, accepted message request, or first sent message completes `START_CHAT`.
3. Accepted family/parent/guardian chat involvement completes `PARENT_INVOLVES`.
4. Accepted marriage approval or admin direct confirmation completes `SHAADI`.

Marriage request flow from a candidate owner:

1. Candidate A owner creates a marriage request for Candidate A and Candidate B.
2. The request stores Candidate A approval immediately.
3. Candidate B owner users receive DB notifications and Firebase push jobs.
4. Candidate B owner accepts or rejects.
5. If accepted, the request becomes `ACCEPTED`, progress becomes `MARRIED`, and both candidates are removed from discovery.
6. If rejected, the request becomes `REJECTED`, and progress remains active.

Marriage request flow from a consultant:

1. Consultant must be actively linked as `CONSULTANT` to at least one candidate in the pair.
2. Consultant creates a pending marriage request.
3. Both candidate owner sides receive DB notifications and push jobs.
4. Both candidate sides must accept before the marriage becomes valid.
5. Consultant married list includes only couples finalized through that consultant.

Admin direct confirmation:

1. Admin identifies the pair by candidate ids, match id, conversation id, or progress id.
2. Backend creates or loads the progress row.
3. Backend marks all steps complete, sets `status: MARRIED`, and cancels pending marriage requests for that pair.

Swipe/feed impact:

- Married candidates are excluded from feed candidate lookups.
- Swipe action is rejected if either side is already in a `MARRIED` progress row.
- Feed session cache for both candidates should be cleared when marriage is finalized.

## Audio and Video Calls

Call start flow:

1. Authenticate user.
2. Resolve candidate access.
3. Check an open conversation exists for the candidate pair.
4. Load candidate owner's plan.
5. For audio, require `plan.canAudioCall`.
6. For video, require `plan.canVideoCall`.
7. Create call record.
8. Use socket signaling to notify the receiver.

Recommended endpoints:

```txt
POST /api/v1/calls/start
PATCH /api/v1/calls/:callId/accept
PATCH /api/v1/calls/:callId/reject
PATCH /api/v1/calls/:callId/end
```

## Candidate Verification Rule

Selected MVP rule: Option A.

Option A, MVP:

- Candidate must be `isActive: ACTIVE`.
- Candidate owner's user account must be verified.

Option B, stricter matrimony:

- Candidate must be `isActive: ACTIVE`.
- Candidate owner's user account must be verified.
- Candidate `verification_status.admin_verified.status` must be `APPROVED`.

Recommendation:

- Use Option A for MVP feed visibility.
- Switch to Option B when admin verification APIs are built.

## API Summary

### Preference APIs

```txt
GET   /api/v1/candidate-preferences/:candidateId
PUT   /api/v1/candidate-preferences/:candidateId
PATCH /api/v1/candidate-preferences/:candidateId
```

### Swipe APIs

```txt
GET  /api/v1/swipes/feed
POST /api/v1/swipes/action
GET  /api/v1/swipes/likes-me
```

### Match APIs

```txt
GET   /api/v1/matches
GET   /api/v1/matches/:matchId
PATCH /api/v1/matches/:matchId/unmatch
```

### Conversation and Message APIs

```txt
GET  /api/v1/conversations
GET  /api/v1/conversations/:conversationId/messages
POST /api/v1/messages
```

### Message Request APIs

```txt
POST  /api/v1/message-requests
GET   /api/v1/message-requests
PATCH /api/v1/message-requests/:requestId/accept
PATCH /api/v1/message-requests/:requestId/reject
```

### Guardian Chat Involvement APIs

```txt
POST   /api/v1/conversations/:conversationId/guardian-requests
GET    /api/v1/conversations/:conversationId/guardian-requests
PATCH  /api/v1/conversations/:conversationId/guardian-requests/:requestId/accept
PATCH  /api/v1/conversations/:conversationId/guardian-requests/:requestId/reject
POST   /api/v1/conversations/:conversationId/guardians
DELETE /api/v1/conversations/:conversationId/guardians/:linkedUserId
```

### Rishta Progress APIs

```txt
GET   /api/v1/rishta-progress
POST  /api/v1/rishta-progress/marriage-requests
PATCH /api/v1/rishta-progress/marriage-requests/:requestId/accept
PATCH /api/v1/rishta-progress/marriage-requests/:requestId/reject
POST  /api/v1/rishta-progress/admin/married
GET   /api/v1/rishta-progress/married
```

### Notification APIs

```txt
GET   /api/v1/notifications
PATCH /api/v1/notifications/:id/seen
```

### Call APIs

```txt
POST  /api/v1/calls/start
PATCH /api/v1/calls/:callId/accept
PATCH /api/v1/calls/:callId/reject
PATCH /api/v1/calls/:callId/end
```

### Route Count Summary

Planned MVP route count in this architecture: 34 routes.

- Preference APIs: 3 routes.
- Swipe APIs: 3 routes.
- Match APIs: 3 routes.
- Conversation and message APIs: 3 routes.
- Message request APIs: 4 routes.
- Guardian chat involvement APIs: 6 routes.
- Rishta progress APIs: 6 routes.
- Notification APIs: 2 routes.
- Call APIs: 4 routes.

## Response Card Shape

The feed should stay lightweight and photo-first. It should return only the fields needed to render the free swipe card, while full profile details stay behind a separate plan-gated profile/details endpoint.

Free feed cards should include:

- name
- age
- gender
- images
- religion
- city-level location as `livesIn`
- optional `distanceKm` when both candidates have coordinates
- personality tags
- `matchScore` for internal/front-end ranking display if needed

```json
{
  "_id": "candidate id",
  "name": "Candidate Name",
  "age": 28,
  "gender": "FEMALE",
  "religion": "ISLAM",
  "livesIn": "Dhaka",
  "distanceKm": 10,
  "personality": ["KIND", "FAMILY_ORIENTED"],
  "images": ["image url"],
  "labels": {
    "religion": "Islam",
    "personality": ["Kind", "Family-oriented"]
  },
  "matchScore": 87
}
```

Do not include these in the free feed card response:

- full address
- bio
- sect
- caste
- height
- occupation
- highest education
- relationship status
- children preference
- move abroad preference
- smoke/drink status
- interests
- score reasons
- verification details
- timestamps

Relationship status, interests, education, occupation, sect/caste, lifestyle fields, full bio, and detailed compatibility reasons should be returned only by the future profile/details endpoint according to the viewer's plan. Online activity should be added later when chat or presence tracking exists. `alreadyLikedMe` should only be true if the viewer has `canSeeWhoLiked`; otherwise omit it or return false.

## Notifications

Use existing BullMQ notification queue.

Events:

- New match created
- Message request received
- Message request accepted or rejected
- New message received
- Guardian involvement request received
- Guardian involvement request accepted or rejected
- Marriage confirmation request received
- Marriage confirmation accepted or rejected
- Admin marriage confirmation completed
- Incoming audio/video call
- Super like received, if product wants this

Notification recipients:

- All active linked users for the target candidate who have active device tokens.
- Marriage request from candidate owner: opposite candidate owner users.
- Marriage request from consultant: owner users from both candidate sides.
- Marriage accepted/rejected: requester, consultant if present, and owner users from both candidate sides.
- If notification preference module is extended later, respect per-user settings.

Delivery strategy:

- Always create a `Notification` DB row first.
- Send Firebase push through BullMQ using active `User.deviceTokens`.
- If no device token exists, keep the DB notification and return/persist push status as not pushed rather than failing the business action.
- Include both `deepLink` for Flutter and `webUrl` for React.
- FCM `data` payload should use string-safe values such as `requestId`, `progressId`, `pairKey`, `candidateIds`, and `action`.

## Cache Strategy

Use Redis for:

- candidate preference read cache
- feed session cache
- plan cache already exists

Invalidate feed cache when:

- candidate updates profile
- candidate updates preferences
- candidate likes, super likes, or passes someone
- target candidate becomes inactive
- match/unmatch happens
- marriage is finalized

Suggested keys:

```txt
candidate_preference:<candidateId>
swipe_feed:<candidateId>:<preferenceHash>:<sessionId>
candidate_swipe_exclusions:<candidateId>
```

## Error Cases

Use clear errors:

- Candidate profile not found
- You do not have access to this candidate profile
- Viewer access cannot perform swipe actions
- Target candidate profile not found
- You cannot swipe your own profile
- This candidate is already matched
- A conversation is already open with this candidate
- Daily like limit reached
- Super like limit reached
- Messaging is locked for your plan
- Message request is already pending
- Message request was not accepted
- Only the target candidate can accept this message request
- Conversation is not open yet
- Parent or guardian involvement request is required before adding guardians
- Parent or guardian involvement request is already pending
- Parent or guardian involvement request was not accepted
- Only the opposite candidate owner can accept this request
- Linked user is not active for this candidate profile
- Audio calls are locked for your plan
- Video calls are locked for your plan
- See who liked you is locked for your plan
- A pending marriage request already exists for this couple
- Only candidate owners can request marriage confirmation
- Consultant must be linked to at least one candidate in this rishta
- This candidate does not belong to the marriage request
- This couple is already married
- Married candidates cannot perform swipe actions
- Notification not found

## Implementation Phases

### Phase 1: Preferences

- Add `candidate-preference` module.
- Add model, validation, route, service, controller.
- Add default preference creation during candidate creation.
- Add preference update endpoint.
- Add tests for validation and ownership.

### Phase 2: Feed

- Add `swipe` module.
- Add feed endpoint.
- Add preference query builder.
- Add scoring utility.
- Exclude self and already acted profiles.
- Return safe candidate cards.

### Phase 3: Swipe Action

- Extend `Like` model with indexes and audit fields.
- Add swipe action endpoint.
- Add quota usage and validation helpers.
- Implement like, super like, pass.
- Add duplicate action handling.

### Phase 4: Match and Conversation Creation

- Extend `Match` with `pairKey`, status, matchedBy, conversation.
- Add unique pair key index.
- On mutual like, create match and conversation.
- Add match list endpoint.
- Add unmatch endpoint.

### Phase 4A: Message Requests

- Add `ConversationMessageRequest` model.
- Add create, list, accept, and reject endpoints.
- Store the first unmatched message as a pending request.
- On accept, create or return the existing conversation and insert the first message.
- Keep message-request conversations separate from matches unless a match is created later.

### Phase 5: Guardian Chat Involvement

- Extend `Conversation` with guardian participants.
- Add `ConversationGuardianRequest` model.
- Add request, list, accept, reject, add guardian, and remove guardian endpoints.
- Add `sentBy` audit fields to messages.
- Enforce owner-only approval before guardians can join a chat.
- Treat the existing conversation as a group chat when active guardians are present.

### Phase 6: Paid Messaging and Calls

- Enforce `canMessage` before message request create.
- Enforce `canMessage` before message create.
- Enforce `canAudioCall` before audio call start.
- Enforce `canVideoCall` before video call start.
- Enforce `canSeeWhoLiked` for likes-me.

### Phase 7: Notifications

- Send match notifications.
- Send message request received notifications.
- Send message request accepted/rejected notifications.
- Send message notifications.
- Send guardian involvement request notifications.
- Send guardian involvement approval/rejection notifications.
- Send marriage request created/accepted/rejected notifications.
- Add notification list and seen endpoints for mobile/web clients.
- Keep notification DB rows even when push tokens are missing.
- Send call notifications/socket events.
- Optionally notify super likes.

### Phase 8: Rishta Progress and Marriage Approval

- Add `rishta_progress` module with progress and marriage request models.
- Complete `MATCHES`, `START_CHAT`, and `PARENT_INVOLVES` from existing match/chat/guardian events.
- Add candidate-owner marriage request flow with opposite-side approval.
- Add consultant marriage request flow requiring both candidate sides to accept.
- Add admin direct marriage confirmation.
- Add admin and consultant married-couple list endpoints.
- Exclude married candidates from feed and swipe actions.
- Clear feed sessions when marriage is finalized.

### Phase 9: Performance and Polish

- Add indexes.
- Add Redis feed cache.
- Add profile boost score.
- Defer admin candidate verification filtering until Option B is enabled.
- Add report/block exclusions.
- Add tests for race conditions around mutual likes.

## Race Conditions to Handle

Mutual likes can happen at the same time. The code must be safe.

Rules:

- Use unique `Like` index for `(likedBy, likedProfile)`.
- Use unique `Match.pairKey`.
- Use unique sparse `Conversation.match`.
- Use unique `Conversation.pairKey` so a matched chat and an accepted message-request chat cannot split into two windows.
- Use a uniqueness guard so only one pending message request exists for the same requester/target pair.
- Use a uniqueness guard so only one pending guardian involvement request exists for the same conversation and candidate pair.
- Use a uniqueness guard so only one pending marriage request exists for the same candidate pair.
- On duplicate key error, fetch the existing match, request, or conversation and return it.

This keeps the system idempotent even if both users like each other, send message requests, or accept a request at the same moment.

## Open Review Decisions

Please decide these before final implementation:

1. Should linked `EDITOR` users be allowed to like/pass, or only `OWNER` users?
2. Should paid plan checks use the authenticated user plan or the candidate owner's plan?
3. Should `PASS` hide a profile forever or only for a period like 30 days?
4. Should users be able to undo a pass or like?
5. Should a free user be allowed to receive messages but not send messages?
6. Should a match be created by `SUPER_LIKE` plus reverse `LIKE`, or only normal mutual likes?
7. Should location distance be included in MVP or delayed until GeoJSON migration?
8. Should the API name be `swipe` or `swap` in routes?
9. Should guardian involvement requests expire automatically if the opposite side does not respond?
10. Which linked-user relations are allowed as chat guardians: only `FATHER`, `MOTHER`, and `GUARDIAN`, or any active linked user?
11. Should guardian removal create a system message or only update the participant list silently?
12. Should the first message request require `plan.canMessage`, or should one pending request be free for all verified candidates?
13. Should admin direct marriage confirmation notify both candidates by default?
14. Should rejected marriage requests be reopenable immediately or require a cooldown?

## Recommended Final Defaults

If no changes are requested, use these defaults:

- Route/module name: `swipe`.
- Matching identity: `candidate`.
- Plan owner: candidate primary owner.
- Daily normal like limit: 50.
- Daily like reset time: 00:00 Asia/Dhaka.
- Feed visibility: Option A, active candidate plus verified owner account.
- Action permission: `OWNER` and `EDITOR` can swipe; `VIEWER` can only view.
- `PASS` hides forever until an explicit reset/undo feature is built.
- `LIKE` and `SUPER_LIKE` both count as positive actions for mutual match.
- Match automatically creates a conversation.
- A candidate can send a first-message request without a match.
- Accepting a message request opens the chat and inserts the first message into that conversation.
- Message requests do not create fake matches.
- Message request creation uses `plan.canMessage` by default unless the product decides to make the first request free.
- Guardian involvement in chat requires opposite candidate owner approval per conversation.
- Only `OWNER` users can request, accept, or reject guardian involvement.
- Acceptance directly adds the requested active parent/guardian linked users into the same conversation.
- The same chat behaves like a group chat when guardians are active.
- Added guardians can send messages if their linked-user role and plan access allow messaging.
- The candidate owner who added guardians can remove them from the conversation at any time.
- Guardian messages store the represented candidate and the actual `sentBy` user.
- Free users can match but cannot send messages/calls unless plan allows.
- Rishta progress is pair-level and advances automatically from backend events.
- Marriage confirmation uses request approval: candidate owner request needs the opposite side; consultant request needs both candidate sides; admin can confirm directly.
- Married candidates are excluded from feed and blocked from new swipe actions.
- Notification rows are saved before push delivery, and missing FCM tokens do not fail the marriage workflow.
- Location filter is optional MVP, with full GeoJSON migration later.
