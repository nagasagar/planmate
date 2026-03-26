const { cors } = require('../../_lib/cors');
const { getSql } = require('../../_lib/db');

module.exports = cors(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' });
  const storyId = req.query.id;
  const { voter_name, voter_id, value } = req.body || {};
  if (!voter_name || !voter_id || !value) return res.status(400).json({ detail: 'voter_name, voter_id, value required' });
  const sql = getSql();
  const storyRows = await sql`SELECT s.status, r.link_hash FROM stories s JOIN rooms r ON s.room_id = r.id WHERE s.id = ${storyId}`;
  if (!storyRows[0]) return res.status(404).json({ detail: 'Story not found' });
  if (storyRows[0].status !== 'voting') return res.status(400).json({ detail: 'Story is not in voting state' });
  await sql`INSERT INTO votes (story_id, voter_name, voter_id, value) VALUES (${storyId}, ${voter_name}, ${voter_id}, ${value}) ON CONFLICT (story_id, voter_id) DO UPDATE SET value = ${value}, created_at = NOW()`;
  res.json({ message: 'Vote submitted' });
});
