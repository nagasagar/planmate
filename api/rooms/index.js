const { cors } = require('../_lib/cors');
const { getSql } = require('../_lib/db');
const { getUserFromRequest } = require('../_lib/auth');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

module.exports = cors(async (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ detail: 'Authentication required' });

  const sql = getSql();

  // GET - list all rooms for logged-in PO
  if (req.method === 'GET') {
    const rooms = await sql`
      SELECT 
        r.*,
        COUNT(s.id) AS story_count,
        COUNT(CASE WHEN s.status = 'completed' THEN 1 END) AS completed_count
      FROM rooms r
      LEFT JOIN stories s ON s.room_id = r.id
      WHERE r.owner_id = ${user.sub}
      GROUP BY r.id
      ORDER BY r.created_at DESC
    `;
    return res.json(rooms);
  }

  // POST - create new room
  if (req.method === 'POST') {
    const { name } = req.body || {};
    const roomName = name || 'Planning Poker';
    const linkHash = crypto
      .createHash('sha256')
      .update(`${user.sub}-${Date.now()}-${uuidv4()}`)
      .digest('hex')
      .slice(0, 12);

    const rows = await sql`
      INSERT INTO rooms (owner_id, owner_name, name, link_hash)
      VALUES (${user.sub}, ${user.name}, ${roomName}, ${linkHash})
      RETURNING *
    `;
    const room = rows[0];
    return res.json({
      id: room.id,
      owner_id: room.owner_id,
      owner_name: room.owner_name,
      name: room.name,
      link_hash: room.link_hash,
      timer_minutes: room.timer_minutes,
      created_at: room.created_at,
    });
  }

  res.status(405).json({ detail: 'Method not allowed' });
});
