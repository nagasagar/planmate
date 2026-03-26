function applyCors(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

function cors(handler) {
  return async (req, res) => {
    applyCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    try {
      return await handler(req, res);
    } catch (err) {
      console.error('API Error:', err);
      return res.status(500).json({ detail: err.message || 'Internal server error' });
    }
  };
}

module.exports = { cors, applyCors };
