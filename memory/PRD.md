# Planning Poker MVP - PRD

## Problem Statement
Planning Poker web app: PO creates room/stories, shares link. Team uses unified /room/[linkHash] view with split pane. States: Ready/Voting/Completed. PO controls only.

## Architecture (Vercel-Ready)
- **Frontend**: React 19/CRA + Tailwind CSS + Framer Motion + Shadcn UI
- **API**: Node.js serverless functions (`/api/*.js`) using `@neondatabase/serverless`
- **Database**: Neon Postgres (direct HTTP queries)
- **Auth**: JWT (bcryptjs + jsonwebtoken)
- **Real-time**: WebSocket (Express/local) + polling fallback (Vercel)
- **Deploy**: Vercel import-ready with `vercel.json`

## What's Been Implemented (March 26, 2026)
### Phase 1: MVP (FastAPI/Python) - Complete
- All core features: rooms, stories, voting, export, WebSocket, auth

### Phase 2: Vercel Port (Node.js) - Complete
- [x] Removed all Python/FastAPI code
- [x] Created Node.js Express server (`/app/backend/server.js`)
- [x] Created 15 Vercel serverless function files (`/app/api/`)
- [x] Shared modules: db.js (@neondatabase/serverless), auth.js, cors.js
- [x] WebSocket (Express) + polling fallback (Vercel)
- [x] vercel.json, package.json, DEPLOY.md
- [x] Frontend unchanged (same API contract)

## Testing Results (Phase 2)
- Backend: 100% (14/14 tests passed on Node.js)
- Frontend: 95% (minor automated test timing issue)

## Prioritized Backlog
### P1
- Neon Auth SDK integration (replace custom JWT)
- Pusher/Ably for true WebSocket on Vercel
- Dark mode toggle

### P2
- PDF export
- Custom deck configuration
- Story drag-and-drop reordering
