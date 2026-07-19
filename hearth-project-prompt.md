# Project Brief: Hearth — Private Discord Alternative for Small Friend Groups

## What this is
Build **Hearth**, a self-hostable, private real-time communication app for a single friend group of 6-8 people. It replicates Discord's core experience (text chat, voice channels, game/screen streaming) but strips out everything aimed at public communities — no server discovery, no invites-to-strangers, no moderation-at-scale tooling. Think of it as "Discord, but it's just us."

## Non-negotiable technical constraints
- Voice channels must support **6-8 concurrent participants**
- Screen/game streaming must support **1080p at 60fps** (~8 Mbps target bitrate) from one participant to the rest of the group simultaneously
- Must run on **free-tier infrastructure** — specifically designed to run on a single Oracle Cloud Always Free VM (2 OCPU / 12GB RAM ARM, 10TB/month egress) or an equivalent home server. No paid SaaS dependencies required for core function.
- Pure peer-to-peer mesh is explicitly ruled out for voice/video — bandwidth math doesn't support it past 3-4 people. Use an SFU (Selective Forwarding Unit) architecture instead.

## Chosen tech stack (do not deviate without strong justification)
- **Media server**: LiveKit, self-hosted (open source SFU) — handles voice, video, and screen-share tracks
- **App/signaling server**: Node.js + TypeScript + Socket.IO — handles auth, friend management, text messages, channel/role state, presence, typing indicators, and issues LiveKit access tokens
- **Database**: PostgreSQL — users, servers/channels, messages, roles, permissions
- **File/image/GIF storage**: Cloudflare R2 (S3-compatible, free tier, zero egress fees) for uploaded images, GIFs, avatars
- **Frontend**: React + Vite (web-first), architected so it can later be wrapped in Tauri for a native desktop app
- **Deployment target**: single Oracle Cloud Free Tier VM running Node server + LiveKit + Postgres via Docker Compose

## Feature scope

### Phase 1 — Foundation
- User accounts (invite-only registration — no public sign-up flow)
- Friends list / DMs
- One private "server" (Hearth instance) with multiple text channels
- Real-time text messaging via WebSocket, with message history persisted in Postgres
- Basic role system: owner, admin, member (even for a friend group, admin controls matter for channel management)

### Phase 2 — Rich chat
- Image/GIF/file upload and inline preview (via R2)
- Emoji reactions
- Typing indicators, online/offline/idle presence
- Message editing and deletion

### Phase 3 — Voice
- Voice channels using LiveKit, supporting 6-8 simultaneous participants
- Push-to-talk and voice-activity modes
- Mute/deafen controls, per-user volume

### Phase 4 — Screen/game streaming
- Screen share via LiveKit at 1080p60, targeting ~8 Mbps bitrate
- Viewer-side quality controls (allow dropping to lower res/framerate if a viewer's bandwidth can't keep up)
- Ensure the SFU fan-out model is used — streamer uploads once, server relays to all viewers

### Phase 5 — Polish
- Push/in-app notifications
- Search across message history
- Basic moderation (kick/ban within the private group, for the rare falling-out)

## What I need from you
1. Confirm or challenge the architecture above — flag anything that won't hold up at this scale or on this hardware
2. Propose a Postgres schema covering users, friendships, servers, channels, messages, roles, and permissions
3. Scaffold the repo structure (monorepo recommended — server, client, shared types)
4. Set up Docker Compose for local dev that mirrors the production deployment (Node app + LiveKit + Postgres)
5. Build Phase 1 end-to-end: working auth, one text channel, real-time messaging
6. After each phase, pause for review before moving to the next — this is a learning project as much as a build, so explain key decisions as you go rather than just producing code silently

## Explicit non-goals
- No public server discovery, categories, or community features
- No support for more than ~8-10 total users ever — don't over-engineer for scale
- No mobile app in this phase (web-first, responsive is enough)
