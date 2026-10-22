module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    runtime: 'serverless',
    cache: 'memory (ephemeral)',
    lyrics: '/api/lyrics',
  });
};
