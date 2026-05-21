# Matrimony RTC Backend Architecture
## Node.js + Express + Socket.IO + Agora + MongoDB

Production-grade realtime calling backend architecture for:

- 1-to-1 audio/video calls
- Guardian invite system
- Small group RTC rooms (max 6 participants)
- Tinder-style matrimony applications
- React + Flutter clients
- Agora RTC integration
- Low latency realtime communication
- Horizontally scalable Socket.IO infrastructure
- Non-blocking APIs
- Event-driven backend architecture

---

# Core Architecture

Client applications communicate with backend using:

- REST APIs → business logic + persistence
- Socket.IO → realtime events
- Agora RTC → audio/video transport

Backend NEVER handles media streams.

Agora handles:
- audio routing
- video routing
- network optimization
- reconnect handling
- RTC scaling

Backend handles:
- permissions
- invitations
- room lifecycle
- participant management
- call state
- token generation
- notifications

---

# High-Level Flow

```txt
React / Flutter
      ↓
REST + Socket.IO
      ↓
Node.js + Express
      ↓
Redis
      ↓
MongoDB
      ↓
Agora RTC Cloud