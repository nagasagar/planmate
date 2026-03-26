const { cors } = require('../_lib/cors');
const { getUserFromRequest } = require('../_lib/auth');

module.exports = cors(async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ detail: 'Method not allowed' });
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ detail: 'Not authenticated' });
  res.json({ user: { id: user.sub, name: user.name, email: user.email } });
});
