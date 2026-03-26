const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

function getSecret() {
  return process.env.JWT_SECRET || 'planning-poker-secret';
}

function createToken(userId, name, email) {
  return jwt.sign({ sub: userId, name, email }, getSecret(), { expiresIn: '7d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, getSecret());
  } catch { return null; }
}

function getUserFromRequest(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  return verifyToken(auth.slice(7));
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function checkPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = { createToken, verifyToken, getUserFromRequest, hashPassword, checkPassword };
