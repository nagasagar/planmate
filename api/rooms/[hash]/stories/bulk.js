const { cors } = require('../../../_lib/cors');
const { getSql } = require('../../../_lib/db');
const { getUserFromRequest } = require('../../../_lib/auth');

module.exports = cors(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' });
  const hash = req.query.hash;
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ detail: 'Authentication required' });
  const sql = getSql();
  const rooms = await sql`SELECT id, owner_id FROM rooms WHERE link_hash = ${hash}`;
  if (!rooms[0] || rooms[0].owner_id !== user.sub) return res.status(403).json({ detail: 'Only the room owner can add stories' });
  const roomId = rooms[0].id;
  const stories = req.body;
  if (!Array.isArray(stories)) return res.status(400).json({ detail: 'Expected array of stories' });
  const maxPos = await sql`SELECT COALESCE(MAX(position), -1) as mp FROM stories WHERE room_id = ${roomId}`;
  let pos = maxPos[0].mp + 1;
  const created = [];
  for (const s of stories) {
    const rows = await sql`INSERT INTO stories (room_id, title, description, position) VALUES (${roomId}, ${s.title || 'Untitled'}, ${s.description || ''}, ${pos++}) RETURNING *`;
    const st = rows[0];
    created.push({
      id: st.id, room_id: st.room_id, title: st.title, description: st.description || '',
      status: st.status, avg_points: st.avg_points, position: st.position, votes: [], created_at: st.created_at
    });
  }
  res.json(created);
});
