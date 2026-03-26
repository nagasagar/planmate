const { cors } = require('../../_lib/cors');
const { getRoomWithStories, getSql } = require('../../_lib/db');
const { getUserFromRequest } = require('../../_lib/auth');

module.exports = cors(async (req, res) => {
  const hash = req.query.hash;

  if (req.method === 'GET') {
    const room = await getRoomWithStories(hash);
    if (!room) return res.status(404).json({ detail: 'Room not found' });
    return res.json(room);
  }

  if (req.method === 'PATCH') {
    const user = getUserFromRequest(req);
    if (!user) return res.status(401).json({ detail: 'Authentication required' });
    const sql = getSql();
    const rooms = await sql`SELECT owner_id FROM rooms WHERE link_hash = ${hash}`;
    if (!rooms[0] || rooms[0].owner_id !== user.sub) return res.status(403).json({ detail: 'Only owner can update room' });
    const timerMinutes = req.query.timer_minutes || req.body?.timer_minutes;
    if (timerMinutes != null) {
      await sql`UPDATE rooms SET timer_minutes = ${parseInt(timerMinutes)} WHERE link_hash = ${hash}`;
    }
    return res.json({ message: 'Room updated' });
  }

  res.status(405).json({ detail: 'Method not allowed' });
});
