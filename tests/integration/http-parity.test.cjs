const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createResolver } = require('../../lib/lyricsResolver');
const { createApp } = require('../../server/server');
const { createHandler } = require('../../api/lyrics');

const query = { title: 'Paper Lantern', artist: 'Fixture Ensemble', album: 'Original Fixture', duration: '180000' };
const fixture = { id: 11, trackName: query.title, artistName: query.artist, albumName: query.album, duration: 180, instrumental: false, plainLyrics: 'An original lantern crosses the bay.\nWe follow its glow until day.', syncedLyrics: null };
function upstream(kind) {
  return { async get(url) {
    if (kind === 'plain') return { status: 200, data: fixture };
    if (kind === 'synced') return { status: 200, data: { ...fixture, syncedLyrics: '[00:01.00]Original opening\n[00:03.00]Original ending' } };
    if (kind === 'instrumental') return { status: 200, data: { ...fixture, instrumental: true, plainLyrics: null } };
    if (kind === 'limited') return { status: 429, data: {}, headers: { 'retry-after': '2' } };
    if (kind === 'mixed') return { status: url.includes('lyrics.ovh') ? 503 : 404, data: {} };
    return { status: 404, data: {} };
  } };
}
function normalize(result) {
  const value = structuredClone(result);
  if (value.lyrics) delete value.lyrics.fetchedAt;
  return value;
}
async function listen(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}
function serverless(resolver) {
  const handler = createHandler({ resolver });
  return http.createServer(async (req, res) => {
    req.query = Object.fromEntries(new URL(req.url, 'http://127.0.0.1').searchParams);
    res.status = value => { res.statusCode = value; return res; };
    res.json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); return res; };
    await handler(req, res);
  });
}
for (const kind of ['plain', 'synced', 'instrumental', 'missing', 'mixed', 'limited']) {
  test(`actual local/serverless adapters have real HTTP parity for ${kind}`, async () => {
    const localResolver = createResolver({ httpClient: upstream(kind), requestDelayMs: 0 });
    const vercelResolver = createResolver({ httpClient: upstream(kind), requestDelayMs: 0 });
    const local = http.createServer(createApp({ resolver: localResolver, serveFrontend: false }));
    const vercel = serverless(vercelResolver);
    const localUrl = await listen(local);
    const vercelUrl = await listen(vercel);
    try {
      const requestPath = `/api/lyrics?${new URLSearchParams(query)}`;
      const localResponse = await fetch(localUrl + requestPath);
      const vercelResponse = await fetch(vercelUrl + requestPath);
      const localBody = await localResponse.json();
      const vercelBody = await vercelResponse.json();
      assert.equal(localResponse.status, vercelResponse.status);
      assert.deepEqual(normalize(localBody), normalize(vercelBody));
      assert.equal(localResponse.status, ['mixed', 'limited'].includes(kind) ? 503 : kind === 'missing' ? 404 : 200);
      if (kind === 'plain') { assert.equal(localBody.lyrics.text, fixture.plainLyrics); assert.deepEqual(localBody.lyrics.synced, []); }
      if (kind === 'missing' || kind === 'mixed') { assert.equal(localBody.lyrics.text, ''); assert.deepEqual(localBody.lyrics.synced, []); }
      if (kind === 'limited') {
        assert.equal(Number(localResponse.headers.get('retry-after')), 2);
        const retried = await fetch(localUrl + requestPath);
        assert.equal(retried.status, 503);
        assert.equal((await retried.json()).lyrics.retryAfter, 2);
      }
    } finally {
      local.closeAllConnections(); vercel.closeAllConnections();
      await Promise.all([new Promise(resolve => local.close(resolve)), new Promise(resolve => vercel.close(resolve))]);
    }
  });
}
