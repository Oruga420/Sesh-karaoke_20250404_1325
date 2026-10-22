const { createHash } = require('node:crypto');
const { createResolver } = require('../../../lib/lyricsResolver');
const { createJsonStore } = require('../../../lib/lyricsStore');
const { createApp } = require('../../../server/server');

async function main() {
  const directory = process.argv[2];
  const enabled = process.argv[3] === 'write';
  let calls = 0;
  const query = { title: 'Restart Lantern', artist: 'Fixture Ensemble', album: 'Original Fixture', duration: 180000 };
  const httpClient = { async get() {
    calls += 1;
    if (!enabled) throw new Error('Upstream disabled in fresh process');
    return { status: 200, data: { id: 91, trackName: query.title, artistName: query.artist,
      albumName: query.album, duration: 180, plainLyrics: 'Original restart lantern keeps its glow.', syncedLyrics: null } };
  } };
  const resolver = createResolver({ store: createJsonStore({ directory }), httpClient, requestDelayMs: 0 });
  const server = createApp({ resolver, serveFrontend: false }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/lyrics?' + new URLSearchParams(query));
    const { lyrics } = await response.json();
    process.stdout.write(JSON.stringify({ pid: process.pid, calls, httpStatus: response.status, status: lyrics.status,
      source: lyrics.source, sourceUrl: lyrics.sourceUrl, cache: lyrics.cache,
      textHash: createHash('sha256').update(lyrics.text).digest('hex') }));
  } finally { await new Promise((resolve) => server.close(resolve)); }
}

main().catch(() => { process.stderr.write('Cache process failed'); process.exitCode = 1; });
