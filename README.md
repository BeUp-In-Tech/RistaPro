# RishtaPro Backend

RishtaPro is a matchmaking backend for candidate profiles, swipe-based discovery, matches, chat, family involvement, calls, consultant workflows, verification, notifications, and rishta progress tracking.

This README is the project handoff and run guide. API documentation is kept separately in `docs/*.md`.

## What The Application Does

- Manages user authentication with credentials and Google OAuth.
- Lets users create and manage candidate profiles for themselves or family members.
- Supports linked-user access so parents, guardians, relatives, and consultants can help manage a candidate profile.
- Provides discovery through swipes, likes, profile visitors, matches, and conversation creation.
- Supports backend-encrypted chat messages, chat media uploads, read receipts, guardian include requests, and real-time Socket.IO events.
- Supports audio/video call control with Agora token generation.
- Tracks rishta progress through match, chat start, parent involvement, and marriage completion.
- Supports consultant cases, meetings, case messages, candidate invites, guest links, and manual marriage records.
- Handles verification documents, notifications, email jobs, Firebase push jobs, and background workers.

## Tech Stack

- Node.js, Express, TypeScript
- MongoDB with Mongoose
- Redis, BullMQ, and Socket.IO Redis adapter
- Socket.IO for realtime chat/call events
- Cloudinary for media storage
- Firebase Admin for push/device support
- Agora for audio/video call tokens
- Passport Google OAuth and JWT authentication
- Zod validation

## Project Structure

- `src/server.ts` starts the HTTP/Socket.IO server.
- `src/app` contains the Express app, modules, middleware, utilities, sockets, and queues.
- `src/app/modules` contains feature modules such as auth, candidate, conversation, message, call, consultant, notification, and rishta progress.
- `docs` contains module-wise API documentation and usage notes.

Important API docs:

- `docs/conversation.md` - conversations, message requests, guardian invite/remove flow, chat history, read receipts.

## Prerequisites

- Node.js
- npm
- MongoDB
- Redis
- Cloudinary account for media uploads
- Firebase service account values for push notifications
- Google OAuth credentials
- Agora credentials for call tokens
- SMTP credentials for email delivery

## Environment Variables

Create a local `.env` file before running the project. Required environment groups are:

- App/runtime: `PORT`, `NODE_ENV`, `BACKEND_URL`, `FRONTEND_URL`, `DEEP_LINK`
- Database/cache: `MONGO_URI`, `REDIS_HOST`, `REDIS_PORT`
- Auth/security: JWT secrets and expirations, OTP JWT values, bcrypt salt rounds, session secret, rate-limit settings
- OAuth: Google OAuth web, iOS, and Android client values
- Media/chat: Cloudinary credentials and `CHAT_ENCRYPTION_KEY`
- Calls: Agora app id/certificate and call timing limits
- Admin seed: admin email and password
- Email: SMTP host, port, sender, auth, and unsubscribe address
- Firebase: service account fields such as project id, private key, client email, auth/token URIs, and certificate URLs

The exact required keys are enforced in `src/app/config/env.ts`.

## Install

```bash
npm install
```

## Run Locally

Start the API server in development mode:

```bash
npm run dev
```

Start the background worker in development mode:

```bash
npm run worker:dev
```

The worker is needed for queued background jobs such as email and notification processing.

## Build And Production Commands

Compile TypeScript:

```bash
npm run build
```

Run the compiled worker:

```bash
npm run worker
```

Available scripts from `package.json`:

| Script | Purpose |
|--------|---------|
| `npm run dev` | Run the API server with `nodemon` and `ts-node`. |
| `npm run build` | Compile TypeScript with `tsc`. |
| `npm run lint` | Run ESLint for `src`. |
| `npm run format` | Format the repo with Prettier. |
| `npm run worker:dev` | Run the BullMQ worker in development mode. |
| `npm run worker` | Run the compiled worker from `dist`. |

## Documentation

API documentation is maintained in the `docs` folder. Keep endpoint request/response details out of this README.

When adding or changing an API:

1. Update the relevant `docs/*.md` module document.
2. Keep README focused on project purpose, features, setup, and operations.
3. Run TypeScript and markdown whitespace checks before handoff.

## Verification

Useful checks before handoff:

```bash
npx.cmd tsc --noEmit
git diff --check
```

On Windows, use `npx.cmd` if PowerShell blocks the `npx.ps1` shim.
