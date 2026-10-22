module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  return res.status(200).json({
    service: 'lyrics',
    endpoints: { lyrics: '/api/lyrics', health: '/api/health' },
    cache: 'memory (ephemeral)',
  });
};
