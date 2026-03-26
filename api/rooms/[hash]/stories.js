const { cors } = require('../../_lib/cors');
const { getSql } = require('../../_lib/db');
const { getUserFromRequest } = require('../../_lib/auth');

module.exports = cors(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' });
  const hash = req.query.hash;
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ detail: 'Authentication required' });
  const sql = getSql();
  const rooms = await sql`SELECT id, owner_id FROM rooms WHERE link_hash = ${hash}`;
  if (!rooms[0]) return res.status(404).json({ detail: 'Room not found' });
  if (rooms[0].owner_id !== user.sub) return res.status(403).json({ detail: 'Only the room owner can add stories' });
  const roomId = rooms[0].id;
  const { title, description } = req.body || {};
  if (!title) return res.status(400).json({ detail: 'title required' });
  const maxPos = await sql`SELECT COALESCE(MAX(position), -1) as mp FROM stories WHERE room_id = ${roomId}`;
  const rows = await sql`INSERT INTO stories (room_id, title, description, position) VALUES (${roomId}, ${title}, ${description || ''}, ${maxPos[0].mp + 1}) RETURNING *`;
  const s = rows[0];
  res.json({
    id: s.id, room_id: s.room_id, title: s.title, description: s.description || '',
    status: s.status, avg_points: s.avg_points, position: s.position, votes: [], created_at: s.created_at
  });
});
