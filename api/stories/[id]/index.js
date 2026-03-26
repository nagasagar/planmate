const { cors } = require('../../_lib/cors');
const { getSql } = require('../../_lib/db');
const { getUserFromRequest } = require('../../_lib/auth');

module.exports = cors(async (req, res) => {
  const storyId = req.query.id;
  const sql = getSql();

  if (req.method === 'PATCH') {
    const user = getUserFromRequest(req);
    if (!user) return res.status(401).json({ detail: 'Authentication required' });
    const storyRows = await sql`SELECT s.*, r.owner_id, r.link_hash FROM stories s JOIN rooms r ON s.room_id = r.id WHERE s.id = ${storyId}`;
    if (!storyRows[0]) return res.status(404).json({ detail: 'Story not found' });
    if (storyRows[0].owner_id !== user.sub) return res.status(403).json({ detail: 'Only the room owner can update stories' });
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
    return res.json({
      id: s.id, room_id: s.room_id, title: s.title, description: s.description || '',
      status: s.status, avg_points: s.avg_points, position: s.position,
      votes: votes.map(v => ({ id: v.id, story_id: v.story_id, voter_name: v.voter_name, voter_id: v.voter_id, value: v.value, created_at: v.created_at })),
      created_at: s.created_at
    });
  }

  if (req.method === 'DELETE') {
    const user = getUserFromRequest(req);
    if (!user) return res.status(401).json({ detail: 'Authentication required' });
    const storyRows = await sql`SELECT r.owner_id, r.link_hash FROM stories s JOIN rooms r ON s.room_id = r.id WHERE s.id = ${storyId}`;
    if (!storyRows[0]) return res.status(404).json({ detail: 'Story not found' });
    if (storyRows[0].owner_id !== user.sub) return res.status(403).json({ detail: 'Only the room owner can delete stories' });
    await sql`DELETE FROM stories WHERE id = ${storyId}`;
    return res.json({ message: 'Story deleted' });
  }

  res.status(405).json({ detail: 'Method not allowed' });
});
