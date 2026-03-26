const { cors } = require('./_lib/cors');

module.exports = cors(async (req, res) => {
  res.json({ status: 'ok', service: 'Planning Poker API' });
});
