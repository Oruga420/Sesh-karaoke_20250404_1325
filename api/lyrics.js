const { resolveLyrics, validateQuery } = require('../lib/lyricsResolver');
const { isLyricsResult } = require('../lib/lyricsContract');

const HTTP_STATUS = { found: 200, instrumental: 200, not_found: 404, unavailable: 503 };

function createHandler({ resolver = { resolveLyrics } } = {}) {
  const resolve = typeof resolver === 'function' ? resolver : resolver.resolveLyrics.bind(resolver);
  return async function lyricsHandler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    function send(status, body) {
      if (typeof res.status === 'function' && typeof res.json === 'function') return res.status(status).json(body);
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify(body));
    }
    if (req.method === 'OPTIONS') {
      if (typeof res.status === 'function') return res.status(200).end();
      res.statusCode = 200;
      return res.end();
    }
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET, OPTIONS');
      return send(405, { error: 'Method not allowed' });
    }
    let request;
    try {
      let query = req.query;
      if (!query) {
        query = {};
        for (const [key, value] of new URL(req.url, 'http://127.0.0.1').searchParams) {
          query[key] = Object.prototype.hasOwnProperty.call(query, key) ? [query[key], value] : value;
        }
      }
      request = validateQuery(query);
    } catch (error) {
      return send(400, { error: 'Invalid query', message: error.message });
    }
    try {
      const lyrics = await resolve(request);
      if (!isLyricsResult(lyrics)) throw new Error('Invalid lyrics result');
      if (lyrics.retryAfter) res.setHeader('Retry-After', String(lyrics.retryAfter));
      return send(HTTP_STATUS[lyrics.status], { lyrics });
    } catch {
      return send(503, { lyrics: { status: 'unavailable', timing: 'none', text: '', synced: [],
        source: null, sourceUrl: null, songInfo: null, requested: request, confidence: 'none',
        fetchedAt: new Date().toISOString(), cache: { hit: false, storage: 'none', persisted: false } } });
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
