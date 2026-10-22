const express = require('express');
const path = require('node:path');
const { existsSync } = require('node:fs');
const { createHandler } = require('../api/lyrics');
const { createResolver } = require('../lib/lyricsResolver');
const { createJsonStore } = require('../lib/lyricsStore');

function createApp({ resolver, buildDir = path.join(__dirname, '..', 'build'), serveFrontend = true } = {}) {
  const app = express();
  const lyricsResolver = resolver || createResolver({
    store: process.env.VERCEL ? null : createJsonStore(),
  });
  app.disable('x-powered-by');
  app.locals.lyricsResolver = lyricsResolver;
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'lyrics-api', serverless: !!process.env.VERCEL,
      storage: process.env.VERCEL ? 'ephemeral-memory' : 'local-json-attempted', pid: process.pid });
  });
  app.all('/api/lyrics', createHandler({ resolver: lyricsResolver }));
  if (serveFrontend && existsSync(path.join(buildDir, 'index.html'))) {
    app.use(express.static(buildDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      return res.sendFile(path.join(buildDir, 'index.html'));
    });
  }
  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3001);
  createApp().listen(port, '127.0.0.1', () => {
    console.log('Lyrics server listening at http://127.0.0.1:' + port);
  });
}

module.exports = { createApp };
