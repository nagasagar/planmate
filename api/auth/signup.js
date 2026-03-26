const { cors } = require('../_lib/cors');
const { getSql } = require('../_lib/db');
const { createToken, hashPassword } = require('../_lib/auth');

module.exports = cors(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' });
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ detail: 'name, email, password required' });
  const sql = getSql();
  const hashed = await hashPassword(password);
  try {
    const rows = await sql`INSERT INTO users (name, email, password_hash) VALUES (${name}, ${email}, ${hashed}) RETURNING id, name, email`;
    const user = rows[0];
    const token = createToken(user.id, user.name, user.email);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    if (err.message?.includes('unique') || err.code === '23505') {
      return res.status(400).json({ detail: 'Email already registered' });
    }
    throw err;
  }
});
