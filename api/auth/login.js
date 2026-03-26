const { cors } = require('../_lib/cors');
const { getSql } = require('../_lib/db');
const { createToken, checkPassword } = require('../_lib/auth');

module.exports = cors(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' });
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
