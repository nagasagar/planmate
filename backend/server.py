from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Header, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
import asyncpg
import os
import json
import uuid
import hashlib
import logging
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import List, Optional, Dict
import csv
import io
import bcrypt
import jwt as pyjwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

app = FastAPI()
api_router = APIRouter(prefix="/api")

pool: Optional[asyncpg.Pool] = None
ws_rooms: Dict[str, Dict[str, dict]] = {}

JWT_SECRET = os.environ.get('JWT_SECRET', 'planning-poker-secret')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

CREATE_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Planning Poker',
    link_hash TEXT UNIQUE NOT NULL,
    timer_minutes INTEGER DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'ready' CHECK (status IN ('ready', 'voting', 'completed')),
    avg_points TEXT,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
    voter_name TEXT NOT NULL,
    voter_id TEXT NOT NULL,
    value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(story_id, voter_id)
);
"""

@app.on_event("startup")
async def startup():
    global pool
    db_url = os.environ.get('NEON_DB_URL')
    if not db_url:
        logger.error("NEON_DB_URL not set!")
        return
    if 'channel_binding' in db_url:
        parts = db_url.split('?')
        if len(parts) > 1:
            base = parts[0]
            params = '&'.join(p for p in parts[1].split('&') if 'channel_binding' not in p)
            db_url = f"{base}?{params}" if params else base
    try:
        pool = await asyncpg.create_pool(db_url, min_size=2, max_size=10)
        async with pool.acquire() as conn:
            await conn.execute(CREATE_TABLES_SQL)
        logger.info("Database connected and tables created")
    except Exception as e:
        logger.error(f"Database connection failed: {e}")

@app.on_event("shutdown")
async def shutdown():
    if pool:
        await pool.close()

# --- Auth Helpers ---
def create_token(user_id: str, name: str, email: str) -> str:
    return pyjwt.encode(
        {"sub": user_id, "name": name, "email": email, "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7},
        JWT_SECRET, algorithm="HS256"
    )

def verify_token(token: str) -> Optional[dict]:
    try:
        return pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except Exception:
        return None

def get_user_from_header(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    return verify_token(authorization[7:])

# --- Models ---
class SignupRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class RoomCreateRequest(BaseModel):
    name: str = "Planning Poker"

class StoryCreateRequest(BaseModel):
    title: str
    description: str = ""

class StoryUpdateRequest(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    avg_points: Optional[str] = None

class VoteSubmitRequest(BaseModel):
    voter_name: str
    voter_id: str
    value: str

# --- WebSocket Broadcast ---
async def broadcast_to_room(room_hash: str, message: dict):
    if room_hash not in ws_rooms:
        return
    dead = []
    for uid, info in ws_rooms[room_hash].items():
        try:
            await info["ws"].send_json(message)
        except Exception:
            dead.append(uid)
    for uid in dead:
        del ws_rooms[room_hash][uid]

# --- Auth Routes ---
@api_router.post("/auth/signup")
async def signup(req: SignupRequest):
    hashed = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
    try:
        async with pool.acquire() as conn:
            user = await conn.fetchrow(
                "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email",
                req.name, req.email, hashed
            )
        token = create_token(str(user['id']), user['name'], user['email'])
        return {"token": token, "user": {"id": str(user['id']), "name": user['name'], "email": user['email']}}
    except asyncpg.UniqueViolationError:
        raise HTTPException(400, "Email already registered")

@api_router.post("/auth/login")
async def login(req: LoginRequest):
    async with pool.acquire() as conn:
        user = await conn.fetchrow("SELECT id, name, email, password_hash FROM users WHERE email = $1", req.email)
    if not user or not bcrypt.checkpw(req.password.encode(), user['password_hash'].encode()):
        raise HTTPException(401, "Invalid email or password")
    token = create_token(str(user['id']), user['name'], user['email'])
    return {"token": token, "user": {"id": str(user['id']), "name": user['name'], "email": user['email']}}

@api_router.get("/auth/me")
async def get_me(authorization: Optional[str] = Header(None)):
    user = get_user_from_header(authorization)
    if not user:
        raise HTTPException(401, "Not authenticated")
    return {"user": {"id": user['sub'], "name": user['name'], "email": user['email']}}

# --- Room Routes ---
@api_router.post("/rooms")
async def create_room(req: RoomCreateRequest, authorization: Optional[str] = Header(None)):
    user = get_user_from_header(authorization)
    if not user:
        raise HTTPException(401, "Authentication required")
    link_hash = hashlib.sha256(f"{user['sub']}-{datetime.now(timezone.utc).isoformat()}-{uuid.uuid4()}".encode()).hexdigest()[:12]
    async with pool.acquire() as conn:
        room = await conn.fetchrow(
            "INSERT INTO rooms (owner_id, owner_name, name, link_hash) VALUES ($1, $2, $3, $4) RETURNING id, owner_id, owner_name, name, link_hash, timer_minutes, created_at",
            user['sub'], user['name'], req.name, link_hash
        )
    return {
        "id": str(room['id']), "owner_id": room['owner_id'], "owner_name": room['owner_name'],
        "name": room['name'], "link_hash": room['link_hash'], "timer_minutes": room['timer_minutes'],
        "created_at": room['created_at'].isoformat()
    }

@api_router.get("/rooms/{link_hash}")
async def get_room(link_hash: str):
    async with pool.acquire() as conn:
        room = await conn.fetchrow("SELECT * FROM rooms WHERE link_hash = $1", link_hash)
        if not room:
            raise HTTPException(404, "Room not found")
        stories = await conn.fetch("SELECT * FROM stories WHERE room_id = $1 ORDER BY position, created_at", room['id'])
        story_ids = [s['id'] for s in stories]
        votes = []
        if story_ids:
            votes = await conn.fetch("SELECT * FROM votes WHERE story_id = ANY($1::uuid[])", story_ids)
    stories_list = []
    for s in stories:
        story_votes = [
            {"id": str(v['id']), "story_id": str(v['story_id']), "voter_name": v['voter_name'],
             "voter_id": v['voter_id'], "value": v['value'], "created_at": v['created_at'].isoformat()}
            for v in votes if v['story_id'] == s['id']
        ]
        stories_list.append({
            "id": str(s['id']), "room_id": str(s['room_id']), "title": s['title'],
            "description": s['description'] or "", "status": s['status'], "avg_points": s['avg_points'],
            "position": s['position'], "votes": story_votes, "created_at": s['created_at'].isoformat()
        })
    return {
        "id": str(room['id']), "owner_id": room['owner_id'], "owner_name": room['owner_name'],
        "name": room['name'], "link_hash": room['link_hash'], "timer_minutes": room['timer_minutes'],
        "created_at": room['created_at'].isoformat(), "stories": stories_list
    }

@api_router.patch("/rooms/{link_hash}")
async def update_room(link_hash: str, timer_minutes: int = Query(None), authorization: Optional[str] = Header(None)):
    user = get_user_from_header(authorization)
    if not user:
        raise HTTPException(401, "Authentication required")
    async with pool.acquire() as conn:
        room = await conn.fetchrow("SELECT owner_id FROM rooms WHERE link_hash = $1", link_hash)
        if not room or room['owner_id'] != user['sub']:
            raise HTTPException(403, "Only owner can update room")
        if timer_minutes is not None:
            await conn.execute("UPDATE rooms SET timer_minutes = $1 WHERE link_hash = $2", timer_minutes, link_hash)
    return {"message": "Room updated"}

# --- Story Routes ---
@api_router.post("/rooms/{link_hash}/stories")
async def create_story(link_hash: str, req: StoryCreateRequest, authorization: Optional[str] = Header(None)):
    user = get_user_from_header(authorization)
    if not user:
        raise HTTPException(401, "Authentication required")
    async with pool.acquire() as conn:
        room = await conn.fetchrow("SELECT id, owner_id FROM rooms WHERE link_hash = $1", link_hash)
        if not room:
            raise HTTPException(404, "Room not found")
        if room['owner_id'] != user['sub']:
            raise HTTPException(403, "Only the room owner can add stories")
        max_pos = await conn.fetchval("SELECT COALESCE(MAX(position), -1) FROM stories WHERE room_id = $1", room['id'])
        story = await conn.fetchrow(
            "INSERT INTO stories (room_id, title, description, position) VALUES ($1, $2, $3, $4) RETURNING *",
            room['id'], req.title, req.description, max_pos + 1
        )
    result = {
        "id": str(story['id']), "room_id": str(story['room_id']), "title": story['title'],
        "description": story['description'] or "", "status": story['status'], "avg_points": story['avg_points'],
        "position": story['position'], "votes": [], "created_at": story['created_at'].isoformat()
    }
    await broadcast_to_room(link_hash, {"type": "story_added", "story": result})
    return result

@api_router.post("/rooms/{link_hash}/stories/bulk")
async def bulk_create_stories(link_hash: str, stories: List[StoryCreateRequest], authorization: Optional[str] = Header(None)):
    user = get_user_from_header(authorization)
    if not user:
        raise HTTPException(401, "Authentication required")
    async with pool.acquire() as conn:
        room = await conn.fetchrow("SELECT id, owner_id FROM rooms WHERE link_hash = $1", link_hash)
        if not room or room['owner_id'] != user['sub']:
            raise HTTPException(403, "Only the room owner can add stories")
        max_pos = await conn.fetchval("SELECT COALESCE(MAX(position), -1) FROM stories WHERE room_id = $1", room['id'])
        created = []
        for i, s in enumerate(stories):
            story = await conn.fetchrow(
                "INSERT INTO stories (room_id, title, description, position) VALUES ($1, $2, $3, $4) RETURNING *",
                room['id'], s.title, s.description, max_pos + 1 + i
            )
            created.append({
                "id": str(story['id']), "room_id": str(story['room_id']), "title": story['title'],
                "description": story['description'] or "", "status": story['status'], "avg_points": story['avg_points'],
                "position": story['position'], "votes": [], "created_at": story['created_at'].isoformat()
            })
    await broadcast_to_room(link_hash, {"type": "stories_bulk_added", "stories": created})
    return created

@api_router.patch("/stories/{story_id}")
async def update_story(story_id: str, req: StoryUpdateRequest, authorization: Optional[str] = Header(None)):
    user = get_user_from_header(authorization)
    if not user:
        raise HTTPException(401, "Authentication required")
    async with pool.acquire() as conn:
        story = await conn.fetchrow(
            "SELECT s.*, r.owner_id, r.link_hash FROM stories s JOIN rooms r ON s.room_id = r.id WHERE s.id = $1",
            uuid.UUID(story_id)
        )
        if not story:
            raise HTTPException(404, "Story not found")
        if story['owner_id'] != user['sub']:
            raise HTTPException(403, "Only the room owner can update stories")

        updates = []
        values = []
        idx = 1

        if req.status is not None:
            updates.append(f"status = ${idx}")
            values.append(req.status)
            idx += 1
            if req.status == 'completed':
                votes = await conn.fetch("SELECT value FROM votes WHERE story_id = $1", uuid.UUID(story_id))
                numeric = []
                for v in votes:
                    try:
                        if v['value'] not in ['☕', '?', '∞']:
                            numeric.append(float(v['value']))
                    except (ValueError, TypeError):
                        pass
                if numeric:
                    avg = round(sum(numeric) / len(numeric), 1)
                    updates.append(f"avg_points = ${idx}")
                    values.append(str(avg))
                    idx += 1
            if req.status == 'ready':
                await conn.execute("DELETE FROM votes WHERE story_id = $1", uuid.UUID(story_id))
                updates.append(f"avg_points = ${idx}")
                values.append(None)
                idx += 1

        if req.title is not None:
            updates.append(f"title = ${idx}")
            values.append(req.title)
            idx += 1
        if req.description is not None:
            updates.append(f"description = ${idx}")
            values.append(req.description)
            idx += 1

        if not updates:
            return {"message": "No updates"}

        values.append(uuid.UUID(story_id))
        query = f"UPDATE stories SET {', '.join(updates)} WHERE id = ${idx} RETURNING *"
        updated = await conn.fetchrow(query, *values)

        votes = await conn.fetch("SELECT * FROM votes WHERE story_id = $1", uuid.UUID(story_id))
        vote_list = [
            {"id": str(v['id']), "story_id": str(v['story_id']), "voter_name": v['voter_name'],
             "voter_id": v['voter_id'], "value": v['value'], "created_at": v['created_at'].isoformat()}
            for v in votes
        ]
        result = {
            "id": str(updated['id']), "room_id": str(updated['room_id']), "title": updated['title'],
            "description": updated['description'] or "", "status": updated['status'],
            "avg_points": updated['avg_points'], "position": updated['position'],
            "votes": vote_list, "created_at": updated['created_at'].isoformat()
        }
    await broadcast_to_room(story['link_hash'], {"type": "story_updated", "story": result})
    return result

@api_router.delete("/stories/{story_id}")
async def delete_story(story_id: str, authorization: Optional[str] = Header(None)):
    user = get_user_from_header(authorization)
    if not user:
        raise HTTPException(401, "Authentication required")
    async with pool.acquire() as conn:
        story = await conn.fetchrow(
            "SELECT r.owner_id, r.link_hash FROM stories s JOIN rooms r ON s.room_id = r.id WHERE s.id = $1",
            uuid.UUID(story_id)
        )
        if not story:
            raise HTTPException(404, "Story not found")
        if story['owner_id'] != user['sub']:
            raise HTTPException(403, "Only the room owner can delete stories")
        await conn.execute("DELETE FROM stories WHERE id = $1", uuid.UUID(story_id))
    await broadcast_to_room(story['link_hash'], {"type": "story_deleted", "story_id": story_id})
    return {"message": "Story deleted"}

# --- Vote Routes ---
@api_router.post("/stories/{story_id}/vote")
async def submit_vote(story_id: str, req: VoteSubmitRequest):
    async with pool.acquire() as conn:
        story = await conn.fetchrow(
            "SELECT s.status, r.link_hash FROM stories s JOIN rooms r ON s.room_id = r.id WHERE s.id = $1",
            uuid.UUID(story_id)
        )
        if not story:
            raise HTTPException(404, "Story not found")
        if story['status'] != 'voting':
            raise HTTPException(400, "Story is not in voting state")
        await conn.execute("""
            INSERT INTO votes (story_id, voter_name, voter_id, value)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (story_id, voter_id) DO UPDATE SET value = $4, created_at = NOW()
        """, uuid.UUID(story_id), req.voter_name, req.voter_id, req.value)
    await broadcast_to_room(story['link_hash'], {
        "type": "vote_submitted", "story_id": story_id,
        "voter_id": req.voter_id, "voter_name": req.voter_name
    })
    return {"message": "Vote submitted"}

# --- Export ---
@api_router.get("/rooms/{link_hash}/export")
async def export_csv_file(link_hash: str):
    async with pool.acquire() as conn:
        room = await conn.fetchrow("SELECT * FROM rooms WHERE link_hash = $1", link_hash)
        if not room:
            raise HTTPException(404, "Room not found")
        stories = await conn.fetch("SELECT * FROM stories WHERE room_id = $1 ORDER BY position", room['id'])
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Story", "Description", "Status", "Average Points", "Votes"])
        for s in stories:
            votes = await conn.fetch("SELECT voter_name, value FROM votes WHERE story_id = $1", s['id'])
            votes_str = "; ".join(f"{v['voter_name']}: {v['value']}" for v in votes)
            writer.writerow([s['title'], s['description'] or '', s['status'], s['avg_points'] or '', votes_str])
    return Response(
        content=output.getvalue(), media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=planning_poker_export.csv"}
    )

# --- WebSocket ---
@api_router.websocket("/ws/{room_hash}")
async def websocket_endpoint(websocket: WebSocket, room_hash: str, user_id: str = Query(...), user_name: str = Query(...)):
    await websocket.accept()
    if room_hash not in ws_rooms:
        ws_rooms[room_hash] = {}
    ws_rooms[room_hash][user_id] = {"ws": websocket, "name": user_name}
    participants = [{"user_id": uid, "user_name": info["name"]} for uid, info in ws_rooms[room_hash].items()]
    await broadcast_to_room(room_hash, {"type": "presence_update", "participants": participants})
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if room_hash in ws_rooms and user_id in ws_rooms[room_hash]:
            del ws_rooms[room_hash][user_id]
            if ws_rooms[room_hash]:
                participants = [{"user_id": uid, "user_name": info["name"]} for uid, info in ws_rooms[room_hash].items()]
                await broadcast_to_room(room_hash, {"type": "presence_update", "participants": participants})
            else:
                del ws_rooms[room_hash]

# --- Health ---
@api_router.get("/")
async def health():
    return {"status": "ok", "service": "Planning Poker API"}

app.include_router(api_router)
app.add_middleware(
    CORSMiddleware, allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"], allow_headers=["*"],
)
