# Planning Poker MVP - PRD

## Problem Statement
Build a complete Planning Poker web app MVP. Agile estimation tool: PO creates room/stories, shares link. Team (PO + guests) uses unified /room/[linkHash] view with split pane layout. States: Ready/Voting/Completed. PO controls only.

## Architecture
- **Frontend**: React/CRA + Tailwind CSS + Framer Motion + Shadcn UI
- **Backend**: FastAPI (thin API proxy, equivalent to Vercel Edge Functions) + asyncpg
- **Database**: Neon Postgres (user-provided)
- **Auth**: JWT-based custom auth (users stored in Neon Postgres)
- **Real-time**: WebSocket via FastAPI for live voting updates and presence

## User Personas
1. **Product Owner (PO)**: Authenticated user who creates rooms, manages stories, controls voting flow
2. **Guest Voter**: Unauthenticated user who joins via link, enters name, and votes

## Core Requirements
- PO creates room → adds stories → starts voting → reveals → exports
- Guests join via shared link → vote on stories → see results
- Real-time sync via WebSocket (votes, presence, state changes)
- Fibonacci voting: 1, 2, 3, 5, 8, 13, 21, ?, ∞, ☕
- Story states: Ready → Voting → Completed
- Average calculation (ignores ☕, ?, ∞)
- CSV export of all stories + votes

## What's Been Implemented (March 26, 2026)
- [x] Full backend API: auth, rooms, stories, votes, export, WebSocket
- [x] Neon Postgres integration with table creation on startup
- [x] JWT authentication for PO operations
- [x] Landing page with Create Room / Join Room
- [x] Auth page with Login / Signup tabs
- [x] Room page with split pane (Stories sidebar + Voting area)
- [x] Fibonacci card selection with Framer Motion animations
- [x] Vote table with card flip animations on reveal
- [x] Timer countdown during voting
- [x] Presence bar showing connected participants
- [x] CSV export
- [x] CSV import for bulk story creation
- [x] WebSocket real-time sync (votes, stories, presence)
- [x] Guest flow (name entry dialog)
- [x] Responsive design

## Testing Results
- Backend: 100% (14/14 tests passed)
- Frontend: 95% (minor HTML nesting warning fixed)

## Prioritized Backlog
### P0 (Complete)
- All core features implemented

### P1 (Next Phase)
- Neon Auth SDK integration (replace custom JWT auth)
- Dark mode toggle
- Custom deck configuration
- Vercel deployment configuration

### P2 (Future)
- PDF export (html2canvas/jsPDF)
- Bulk CSV import with preview
- Room settings (timer duration, deck type)
- Reconnection resilience (resume session after disconnect)
- Story reordering (drag and drop)

## Next Tasks
1. Switch to Neon Auth SDK when deploying to Vercel
2. Add dark mode toggle
3. Add custom deck support
4. Create Vercel deployment config (vercel.json)
5. Add Drizzle schema for migration management
