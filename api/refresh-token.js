const axios = require('axios');

function createHandler({ httpClient = axios, clientId } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const refreshToken = req.body?.refreshToken;
    if (typeof refreshToken !== 'string' || !refreshToken.trim() || refreshToken.length > 4096) {
      return res.status(400).json({ error: 'Refresh token is required in the request body' });
    }
    const publicClientId = clientId || process.env.SPOTIFY_CLIENT_ID || process.env.REACT_APP_SPOTIFY_CLIENT_ID;
    if (!publicClientId) return res.status(503).json({ error: 'Spotify client is not configured' });
    try {
      const response = await httpClient.post('https://accounts.spotify.com/api/token', new URLSearchParams({
        grant_type: 'refresh_token', refresh_token: refreshToken, client_id: publicClientId,
      }).toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 7000,
        maxContentLength: 65536,
      });
      if (typeof response.data?.access_token !== 'string') throw new Error('Invalid token response');
      return res.status(200).json({
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in,
        ...(typeof response.data.refresh_token === 'string' ? { refreshToken: response.data.refresh_token } : {}),
      });
    } catch (error) {
      const status = error.response?.status;
      if (status === 429) {
        const delay = Math.min(3600, Math.max(1, Number(error.response.headers?.['retry-after']) || 30));
        res.setHeader('Retry-After', String(delay));
        return res.status(429).json({ error: 'Spotify temporarily rate limited this request', retryAfter: delay });
      }
      return res.status(status === 400 || status === 401 ? 401 : 503).json({ error: 'Unable to refresh Spotify session' });
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
