const { cors } = require('./_lib/cors');
const { initDb } = require('./_lib/db');

module.exports = cors(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' });
  await initDb();
  res.json({ message: 'Database tables created/verified' });
});
