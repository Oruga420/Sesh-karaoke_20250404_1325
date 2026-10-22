const { timingSafeEqual } = require('node:crypto');

// Disabled by default. Diagnostics never echo request headers, tokens or keys.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const expected = process.env.DEBUG_ACCESS_TOKEN;
  const received = req.headers?.authorization;
  const authorized = typeof expected === 'string' && expected.length > 0 &&
    typeof received === 'string' &&
    Buffer.byteLength(received) === Buffer.byteLength(`Bearer ${expected}`) &&
    timingSafeEqual(Buffer.from(received), Buffer.from(`Bearer ${expected}`));
  if (!authorized) return res.status(404).json({ error: 'Not found' });
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'lyrics',
    runtime: 'serverless',
    cache: 'memory (ephemeral)',
    endpoints: { lyrics: '/api/lyrics', health: '/api/health' },
  });
};
