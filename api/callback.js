// PKCE validation and code exchange belong to the SPA callback.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const query = new URLSearchParams();
  for (const field of ['code', 'state', 'error']) {
    const value = req.query?.[field];
    if (typeof value === 'string' && value.length <= 4096) query.set(field, value);
  }
  const suffix = query.toString();
  return res.redirect(302, `/callback${suffix ? `?${suffix}` : ''}`);
};
