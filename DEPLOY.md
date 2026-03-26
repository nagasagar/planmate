# Planmate - Planning Poker

## Deploy to Vercel

### 1. Prerequisites
- Neon Postgres database (https://neon.tech)
- Vercel account (https://vercel.com)

### 2. Environment Variables
Set these in Vercel Dashboard → Project → Settings → Environment Variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `NEON_DB_URL` | Neon Postgres pooled connection string | `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require` |
| `JWT_SECRET` | Secret for JWT token signing | `your-secure-random-string` |
| `REACT_APP_BACKEND_URL` | Your Vercel domain (empty for same-origin) | `` (leave empty) |

### 3. Deploy
```bash
# Import from GitHub
vercel import https://github.com/nagasagar/planmate

# Or deploy from CLI
vercel --prod
```

### 4. Initialize Database
After first deploy, create tables by calling:
```bash
curl -X POST https://your-app.vercel.app/api/setup
```

### Architecture

```
├── api/                    # Vercel Serverless Functions (Node.js)
│   ├── _lib/              # Shared modules (DB, Auth, CORS)
│   ├── auth/              # Auth endpoints (signup, login, me)
│   ├── rooms/             # Room CRUD + export
│   │   └── [hash]/        # Dynamic room routes
│   └── stories/           # Story CRUD + voting
│       └── [id]/          # Dynamic story routes
├── frontend/              # React CRA frontend
│   ├── src/
│   └── public/
├── vercel.json            # Vercel deployment config
└── package.json           # API dependencies
```

### Real-time Updates
- **Local/Express**: WebSocket via `ws` library (full real-time)
- **Vercel**: Automatic polling fallback (2.5s interval) — works out of the box
- **Optional**: Add Pusher/Ably for true WebSocket on Vercel

### Tech Stack
- **Frontend**: React 19, Tailwind CSS, Framer Motion, Shadcn UI
- **API**: Node.js serverless functions (Vercel)
- **Database**: Neon Postgres via `@neondatabase/serverless`
- **Auth**: JWT (bcryptjs + jsonwebtoken)
