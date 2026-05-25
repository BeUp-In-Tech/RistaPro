# RishtaPro - Consultant & Meeting API Flow

The consultation feature in RishtaPro is divided into two distinct but interconnected modules: **Consultant Module** (`/api/v1/consultant`) and **Meeting Schedule Module** (`/api/v1/meeting-schedules`). This separation keeps meeting logistics clean while the consultant module handles cases, chats, and guest links.

Below is a comprehensive explanation of how the Consultant and Candidate flow works.

## 1. Consultant Discovery (Consultant Module)
Before a full "Case" or meeting starts, candidates (with Platinum access) can find available consultants.

*   **Find Available Consultants:** 
    A candidate lists active consultants they can choose to work with.
    *   `GET /api/v1/consultant/available?candidateId=<id>` (Role: USER)

## 2. Scheduling a Meeting (Meeting Schedule Module)
Candidates can request a formal video meeting with a chosen consultant. 
*Note: Requesting a meeting automatically creates or reuses a linked "Case" in the background.*

*   **Request a Meeting:** 
    The user requests a meeting with a specific consultant and proposes time slots.
    *   `POST /api/v1/meeting-schedules` (Role: USER)
    *   *Returns:* `meetingId` and a linked `caseId`.
*   **Manage Meetings:** 
    Both users and consultants can view their scheduled or pending meetings.
    *   `GET /api/v1/meeting-schedules` (Role: USER, CONSULTANT)
*   **Confirm/Reschedule:** 
    The consultant sets the final scheduled time. Either party can propose a new time slot to reschedule.
    *   `PATCH /api/v1/meeting-schedules/:meetingId/confirm` (Role: CONSULTANT)
    *   `PATCH /api/v1/meeting-schedules/:meetingId/reschedule` (Role: USER, CONSULTANT)
*   **Join Meeting Call:** 
    When the meeting time arrives, participants use this endpoint to join the Agora RTC room.
    *   `POST /api/v1/meeting-schedules/:meetingId/join` (Role: USER, CONSULTANT)

## 3. Consultation Cases (Consultant Module)
A **"Case"** is the central workspace or "project folder" for a specific matchmaking effort managed by a Consultant. Instead of fragmented chats, a Case centralizes collaboration by acting as a single secure room for unified chat and guest/family access.

### How Cases Work (The Lifecycle)
1. **Starts 1-on-1:** A Case usually begins with just the Consultant and Candidate A. They chat and discuss preferences.
2. **Introducing a Match:** The Consultant finds a good match (Candidate B) and uses the Case to send them an invite.
3. **The Case Expands:** Candidate B accepts the invite. Now, the Case contains **Consultant + Candidate A + Candidate B**, allowing them to all communicate in a unified thread.
4. **Bringing in Family:** The Consultant generates a temporary Guest Invite link and sends it to the parents. Parents click the link and join the Case chat/calls without needing an app account.
5. **The Final Outcome:** If families agree, the Consultant logs a Marriage Record linked to this Case. The Case is marked as `MARRIED` and the project is successful.

### Who Creates a Case and How?
*   **Created by the Candidate (Most Common):**
    When a Platinum candidate starts a chat or requests a meeting, the backend automatically creates a new Case involving just that Candidate and the Consultant.
    *   `POST /api/v1/consultant/cases/start` (Role: USER) - Candidate explicitly starts a case to chat.
    *   *(Note: `POST /api/v1/meeting-schedules` also creates a case automatically in the background).*
*   **Created by the Consultant:**
    A consultant can manually create a new case from their dashboard, starting with one or two candidates immediately.
    *   `POST /api/v1/consultant/cases` (Role: CONSULTANT)

### View Active Cases
Participants can view their list of active cases and the details of a specific case.
*   `GET /api/v1/consultant/cases` (Role: USER, CONSULTANT)
*   `GET /api/v1/consultant/cases/:caseId` (Role: USER, CONSULTANT)

## 4. Candidate Management inside a Case (Consultant Module)
Once a case is running, the consultant can introduce other registered candidates into the discussion.

*   **Propose Candidates:**
    The consultant adds potential matches directly to the case, or sends out invites to another registered candidate.
    *   `POST /api/v1/consultant/cases/:caseId/candidates` (Role: CONSULTANT) - Direct addition.
    *   `POST /api/v1/consultant/cases/:caseId/candidate-invites` (Role: CONSULTANT) - Sends an invite.
*   **Candidate Response:**
    The invited candidate's owner can accept or decline the consultant's invitation to join the case.
    *   `POST /api/v1/consultant/candidate-invites/:inviteId/accept` (Role: USER)
    *   `POST /api/v1/consultant/candidate-invites/:inviteId/decline` (Role: USER)

## 5. Case Communication (Consultant Module)
Parties involved in a case need to communicate continuously outside of formal scheduled meetings.

*   **In-Case Messaging (Chat):**
    Users and consultants can chat inside the case context.
    *   `GET /api/v1/consultant/cases/:caseId/messages` (Role: USER, CONSULTANT)
    *   `POST /api/v1/consultant/cases/:caseId/messages` (Role: USER, CONSULTANT)

## 6. Guest Access (Consultant Module)
Matchmaking often involves family members who do not have accounts on the app. The Consultant can generate temporary "Guest Invites" tied to a specific case.

*   **Generate Invite:**
    *   `POST /api/v1/consultant/cases/:caseId/guest-invites` (Role: CONSULTANT) -> Generates a secure, expiring `:token`.
*   **Guest Actions (No Auth Required, Uses Token):**
    Using the generated token in the URL, external family members can access limited case features.
    *   `GET /api/v1/consultant/guest-invites/:token` - View case summary.
    *   `GET /api/v1/consultant/guest-invites/:token/messages` & `POST /api/v1/consultant/guest-invites/:token/messages` - Chat in the case thread.
    *   `POST /api/v1/consultant/guest-invites/:token/meetings/:meetingId/join` - Guest joins a formal scheduled meeting.

## 7. Final Outcomes (Consultant Module)

*   **Marriage Records:**
    Once a successful match is made through the consultation, the consultant creates a permanent record. If two real candidates are linked, their `RishtaProgress` is finalized.
    *   `POST /api/v1/consultant/marriage-records` (Role: CONSULTANT)
    *   `GET /api/v1/consultant/marriage-records` (Role: CONSULTANT)

---
### Summary of the Flow
1. **Discovery & Request:** Candidate finds Consultant -> Requests Meeting (creates `meetingId` and `caseId`).
2. **Scheduling:** Consultant confirms Meeting schedule. 
3. **Collaboration (Case):** Consultant uses the linked Case to invite other candidates or generate Guest tokens for family members.
4. **Communication:** Participants chat via Case Messages and join the formal Meeting via the Meeting Schedule module.
5. **Success:** A match is made -> Consultant creates a Marriage Record.
