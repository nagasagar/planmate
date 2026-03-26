const { cors } = require('../../_lib/cors');
const { getSql } = require('../../_lib/db');

module.exports = cors(async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ detail: 'Method not allowed' });
  const hash = req.query.hash;
  const sql = getSql();
  const rooms = await sql`SELECT * FROM rooms WHERE link_hash = ${hash}`;
  if (!rooms[0]) return res.status(404).json({ detail: 'Room not found' });
  const room = rooms[0];
  const stories = await sql`SELECT * FROM stories WHERE room_id = ${room.id} ORDER BY position`;
  let csv = 'Story,Description,Status,Average Points,Votes\n';
  for (const s of stories) {
    const votes = await sql`SELECT voter_name, value FROM votes WHERE story_id = ${s.id}`;
    const votesStr = votes.map(v => `${v.voter_name}: ${v.value}`).join('; ');
    const escape = (str) => `"${(str || '').replace(/"/g, '""')}"`;
    csv += `${escape(s.title)},${escape(s.description)},${escape(s.status)},${escape(s.avg_points || '')},${escape(votesStr)}\n`;
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=planning_poker_export.csv');
  res.send(csv);
});
