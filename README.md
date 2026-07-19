# 🔥 Hearth

**Private Discord alternative for small friend groups.**

Hearth is a self-hostable, real-time communication app designed for a single friend group of 6-8 people. It replicates Discord's core experience — text chat, voice channels, screen streaming — without the complexity of public communities.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React + Vite + TypeScript |
| **Backend** | Node.js + Express + Socket.IO |
| **Database** | PostgreSQL |
| **Media (Voice/Video)** | LiveKit (self-hosted SFU) |
| **File Storage** | Cloudflare R2 (Phase 2) |
| **Deployment** | Docker Compose on Oracle Cloud Free Tier |

## Quick Start

### Prerequisites

- Node.js ≥ 20
- Docker & Docker Compose

### 1. Start Infrastructure

```bash
cd docker
docker compose up -d
```

This starts PostgreSQL and LiveKit.

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Database

```bash
cp .env.example .env   # Edit if needed (defaults work for dev)
npm run db:seed
```

This creates the schema, a default admin user, channels, and an invite code.

### 4. Start Development

```bash
# Terminal 1: Start the API server
npm run dev:server

# Terminal 2: Start the React client
npm run dev:client
```

- **Client**: http://localhost:5173
- **Server**: http://localhost:3001
- **API Health**: http://localhost:3001/api/health

### 5. Log In

Use the credentials shown by the seed script, or register with the invite code it generated.

## Project Structure

```
hearth/
├── packages/
│   ├── client/        # React + Vite frontend
│   ├── server/        # Node.js + TypeScript backend
│   └── shared/        # Shared types & constants
├── docker/            # Docker Compose + LiveKit config
├── .env.example       # Environment variable template
└── package.json       # npm workspaces root
```

## Phases

- [x] **Phase 1** — Auth, text channels, real-time messaging
- [ ] **Phase 2** — Image upload, emoji reactions, typing indicators, presence
- [ ] **Phase 3** — Voice channels via LiveKit
- [ ] **Phase 4** — Screen/game streaming at 1080p60
- [ ] **Phase 5** — Notifications, search, moderation
