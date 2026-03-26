require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const url = require('url');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { getSql, initDb, getRoomWithStories } = require('../api/_lib/db');
const { createToken, getUserFromRequest, hashPassword, checkPassword } = require('../api/_lib/auth');

const app = express();
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

const server = http.createServer(app);

// ─── WebSocket ───
const wsRooms = new Map();
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const parsed = url.parse(request.url, true);
  const match = parsed.pathname.match(/^\/api\/ws\/(.+)$/);
  if (match) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      const roomHash = match[1];
      const userId = parsed.query.user_id;
      const userName = decodeURIComponent(parsed.query.user_name || '');
      handleWsConnection(ws, roomHash, userId, userName);
    });
  } else {
    socket.destroy();
  }
});

function broadcastToRoom(roomHash, message) {
  const room = wsRooms.get(roomHash);
  if (!room) return;
  const data = JSON.stringify(message);
  const dead = [];
  for (const [uid, info] of room.entries()) {
    try { info.ws.send(data); } catch { dead.push(uid); }
  }
  dead.forEach(uid => room.delete(uid));
}

function handleWsConnection(ws, roomHash, userId, userName) {
  if (!wsRooms.has(roomHash)) wsRooms.set(roomHash, new Map());
  wsRooms.get(roomHash).set(userId, { ws, name: userName });

  const participants = [];
  for (const [uid, info] of wsRooms.get(roomHash).entries()) {
    participants.push({ user_id: uid, user_name: info.name });
  }
  broadcastToRoom(roomHash, { type: 'presence_update', participants });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
    } catch {}
  });

  ws.on('close', () => {
    const room = wsRooms.get(roomHash);
    if (room) {
      room.delete(userId);
      if (room.size === 0) {
        wsRooms.delete(roomHash);
      } else {
        const p = [];
        for (const [uid, info] of room.entries()) p.push({ user_id: uid, user_name: info.name });
        broadcastToRoom(roomHash, { type: 'presence_update', participants: p });
      }
    }
  });
}

// ─── API Routes ───
app.get('/api/', (req, res) => res.json({ status: 'ok', service: 'Planning Poker API' }));

app.post('/api/setup', async (req, res) => {
  await initDb();
  res.json({ message: 'Database tables created/verified' });
});

// Auth
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ detail: 'name, email, password required' });
  const sql = getSql();
  const hashed = await hashPassword(password);
  try {
    const rows = await sql`INSERT INTO users (name, email, password_hash) VALUES (${name}, ${email}, ${hashed}) RETURNING id, name, email`;
    const user = rows[0];
    const token = createToken(user.id, user.name, user.email);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    if (err.message?.includes('unique') || err.code === '23505') return res.status(400).json({ detail: 'Email already registered' });
    console.error(err);
    res.status(500).json({ detail: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ detail: 'email and password required' });
  const sql = getSql();
  const rows = await sql`SELECT id, name, email, password_hash FROM users WHERE email = ${email}`;
  const user = rows[0];
  if (!user || !(await checkPassword(password, user.password_hash))) {
    return res.status(401).json({ detail: 'Invalid email or password' });
  }
  const token = createToken(user.id, user.name, user.email);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.get('/api/auth/me', (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ detail: 'Not authenticated' });
  res.json({ user: { id: user.sub, name: user.name, email: user.email } });
});

// Rooms
app.post('/api/rooms', async (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ detail: 'Authentication required' });
  const { name } = req.body || {};
  const roomName = name || 'Planning Poker';
  const linkHash = crypto.createHash('sha256').update(`${user.sub}-${Date.now()}-${uuidv4()}`).digest('hex').slice(0, 12);
  const sql = getSql();
  const rows = await sql`INSERT INTO rooms (owner_id, owner_name, name, link_hash) VALUES (${user.sub}, ${user.name}, ${roomName}, ${linkHash}) RETURNING *`;
  const room = rows[0];
  res.json({ id: room.id, owner_id: room.owner_id, owner_name: room.owner_name, name: room.name, link_hash: room.link_hash, timer_minutes: room.timer_minutes, created_at: room.created_at });
});

app.get('/api/rooms/:hash', async (req, res) => {
  const room = await getRoomWithStories(req.params.hash);
  if (!room) return res.status(404).json({ detail: 'Room not found' });
  res.json(room);
});

app.patch('/api/rooms/:hash', async (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ detail: 'Authentication required' });
  const sql = getSql();
  const rooms = await sql`SELECT owner_id FROM rooms WHERE link_hash = ${req.params.hash}`;
  if (!rooms[0] || rooms[0].owner_id !== user.sub) return res.status(403).json({ detail: 'Only owner can update room' });
  const tm = req.query.timer_minutes || req.body?.timer_minutes;
  if (tm != null) await sql`UPDATE rooms SET timer_minutes = ${parseInt(tm)} WHERE link_hash = ${req.params.hash}`;
  res.json({ message: 'Room updated' });
});

// Stories
app.post('/api/rooms/:hash/stories', async (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ detail: 'Authentication required' });
  const sql = getSql();
  const rooms = await sql`SELECT id, owner_id FROM rooms WHERE link_hash = ${req.params.hash}`;
  if (!rooms[0]) return res.status(404).json({ detail: 'Room not found' });
  if (rooms[0].owner_id !== user.sub) return res.status(403).json({ detail: 'Only the room owner can add stories' });
  const roomId = rooms[0].id;
  const { title, description } = req.body || {};
  if (!title) return res.status(400).json({ detail: 'title required' });
  const maxPos = await sql`SELECT COALESCE(MAX(position), -1) as mp FROM stories WHERE room_id = ${roomId}`;
  const rows = await sql`INSERT INTO stories (room_id, title, description, position) VALUES (${roomId}, ${title}, ${description || ''}, ${maxPos[0].mp + 1}) RETURNING *`;
  const s = rows[0];
  const result = { id: s.id, room_id: s.room_id, title: s.title, description: s.description || '', status: s.status, avg_points: s.avg_points, position: s.position, votes: [], created_at: s.created_at };
  broadcastToRoom(req.params.hash, { type: 'story_added', story: result });
  res.json(result);
});

app.post('/api/rooms/:hash/stories/bulk', async (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ detail: 'Authentication required' });
  const sql = getSql();
  const rooms = await sql`SELECT id, owner_id FROM rooms WHERE link_hash = ${req.params.hash}`;
  if (!rooms[0] || rooms[0].owner_id !== user.sub) return res.status(403).json({ detail: 'Only the room owner can add stories' });
  const roomId = rooms[0].id;
  const stories = req.body;
  if (!Array.isArray(stories)) return res.status(400).json({ detail: 'Expected array' });
  const maxPos = await sql`SELECT COALESCE(MAX(position), -1) as mp FROM stories WHERE room_id = ${roomId}`;
  let pos = maxPos[0].mp + 1;
  const created = [];
  for (const st of stories) {
    const rows = await sql`INSERT INTO stories (room_id, title, description, position) VALUES (${roomId}, ${st.title || 'Untitled'}, ${st.description || ''}, ${pos++}) RETURNING *`;
    const s = rows[0];
    created.push({ id: s.id, room_id: s.room_id, title: s.title, description: s.description || '', status: s.status, avg_points: s.avg_points, position: s.position, votes: [], created_at: s.created_at });
  }
  broadcastToRoom(req.params.hash, { type: 'stories_bulk_added', stories: created });
  res.json(created);
});

// Story update/delete
app.patch('/api/stories/:id', async (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ detail: 'Authentication required' });
  const sql = getSql();
  const storyId = req.params.id;
  const storyRows = await sql`SELECT s.*, r.owner_id, r.link_hash FROM stories s JOIN rooms r ON s.room_id = r.id WHERE s.id = ${storyId}`;
  if (!storyRows[0]) return res.status(404).json({ detail: 'Story not found' });
  if (storyRows[0].owner_id !== user.sub) return res.status(403).json({ detail: 'Only the room owner can update stories' });
  const linkHash = storyRows[0].link_hash;
  const current = storyRows[0];
  const { status, title, description } = req.body || {};
  const newStatus = status ?? current.status;
  const newTitle = title ?? current.title;
  const newDesc = description ?? (current.description || '');
  let newAvg = current.avg_points;

  if (status === 'completed') {
    const voteRows = await sql`SELECT value FROM votes WHERE story_id = ${storyId}`;
    const numeric = voteRows.filter(v => !['☕', '?', '∞'].includes(v.value)).map(v => parseFloat(v.value)).filter(n => !isNaN(n));
    if (numeric.length > 0) newAvg = String((numeric.reduce((a, b) => a + b, 0) / numeric.length).toFixed(1));
  }
  if (status === 'ready') {
    await sql`DELETE FROM votes WHERE story_id = ${storyId}`;
    newAvg = null;
  }

  await sql`UPDATE stories SET status = ${newStatus}, title = ${newTitle}, description = ${newDesc}, avg_points = ${newAvg} WHERE id = ${storyId}`;
  const updated = await sql`SELECT * FROM stories WHERE id = ${storyId}`;
  const votes = await sql`SELECT * FROM votes WHERE story_id = ${storyId}`;
  const s = updated[0];
  const result = {
    id: s.id, room_id: s.room_id, title: s.title, description: s.description || '',
    status: s.status, avg_points: s.avg_points, position: s.position,
    votes: votes.map(v => ({ id: v.id, story_id: v.story_id, voter_name: v.voter_name, voter_id: v.voter_id, value: v.value, created_at: v.created_at })),
    created_at: s.created_at
  };
  broadcastToRoom(linkHash, { type: 'story_updated', story: result });
  res.json(result);
});

app.delete('/api/stories/:id', async (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ detail: 'Authentication required' });
  const sql = getSql();
  const storyId = req.params.id;
  const storyRows = await sql`SELECT r.owner_id, r.link_hash FROM stories s JOIN rooms r ON s.room_id = r.id WHERE s.id = ${storyId}`;
  if (!storyRows[0]) return res.status(404).json({ detail: 'Story not found' });
  if (storyRows[0].owner_id !== user.sub) return res.status(403).json({ detail: 'Only the room owner can delete stories' });
  await sql`DELETE FROM stories WHERE id = ${storyId}`;
  broadcastToRoom(storyRows[0].link_hash, { type: 'story_deleted', story_id: storyId });
  res.json({ message: 'Story deleted' });
});

// Votes
app.post('/api/stories/:id/vote', async (req, res) => {
  const sql = getSql();
  const storyId = req.params.id;
  const { voter_name, voter_id, value } = req.body || {};
  if (!voter_name || !voter_id || !value) return res.status(400).json({ detail: 'voter_name, voter_id, value required' });
  const storyRows = await sql`SELECT s.status, r.link_hash FROM stories s JOIN rooms r ON s.room_id = r.id WHERE s.id = ${storyId}`;
  if (!storyRows[0]) return res.status(404).json({ detail: 'Story not found' });
  if (storyRows[0].status !== 'voting') return res.status(400).json({ detail: 'Story is not in voting state' });
  await sql`INSERT INTO votes (story_id, voter_name, voter_id, value) VALUES (${storyId}, ${voter_name}, ${voter_id}, ${value}) ON CONFLICT (story_id, voter_id) DO UPDATE SET value = ${value}, created_at = NOW()`;
  broadcastToRoom(storyRows[0].link_hash, { type: 'vote_submitted', story_id: storyId, voter_id, voter_name });
  res.json({ message: 'Vote submitted' });
});

// Export
app.get('/api/rooms/:hash/export', async (req, res) => {
  const sql = getSql();
  const rooms = await sql`SELECT * FROM rooms WHERE link_hash = ${req.params.hash}`;
  if (!rooms[0]) return res.status(404).json({ detail: 'Room not found' });
  const stories = await sql`SELECT * FROM stories WHERE room_id = ${rooms[0].id} ORDER BY position`;
  let csv = 'Story,Description,Status,Average Points,Votes\n';
  for (const s of stories) {
    const votes = await sql`SELECT voter_name, value FROM votes WHERE story_id = ${s.id}`;
    const votesStr = votes.map(v => `${v.voter_name}: ${v.value}`).join('; ');
    const esc = (str) => `"${(str || '').replace(/"/g, '""')}"`;
    csv += `${esc(s.title)},${esc(s.description)},${esc(s.status)},${esc(s.avg_points || '')},${esc(votesStr)}\n`;
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=planning_poker_export.csv');
  res.send(csv);
});

// ─── Start ───
initDb().then(() => {
  server.listen(8001, '0.0.0.0', () => {
    console.log('Planning Poker API running on port 8001');
  });
}).catch(err => {
  console.error('DB init failed:', err);
  server.listen(8001, '0.0.0.0', () => {
    console.log('Server started (DB init failed - run POST /api/setup)');
  });
});
