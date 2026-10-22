const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createResolver, recordingKey, validateQuery } = require('../../lib/lyricsResolver');
const { parseLrc } = require('../../lib/lrcParser');

const request = { title: 'Paper Lantern', artist: 'Fixture Ensemble', album: 'Original Fixture', duration: 180000 };
const original = 'An original lantern crosses the bay.\nWe follow its glow until day.';
const record = (changes = {}) => ({ id: 23, trackName: request.title, artistName: request.artist,
  albumName: request.album, duration: 180, instrumental: false, plainLyrics: original, syncedLyrics: null, ...changes });
const response = (data, status = 200, headers = {}) => ({ status, data, headers });
function clientFor(run) {
  const calls = [];
  return { calls, async get(url, config) { calls.push({ url, config }); return run(new URL(url), config); } };
}
function resolverFor(run, options = {}) {
  const httpClient = clientFor(run);
  return { httpClient, resolver: createResolver({ httpClient, requestDelayMs: 0, ...options }) };
}

test('parser applies offsets, multiple tags and skips invalid seconds without fake timings', () => {
  assert.deepEqual(parseLrc('[00:02.50][00:04:50]Original refrain\n[offset:-1000]\n[00:60.00]Invalid'), [
    { time: 1.5, words: ['Original', 'refrain'] }, { time: 3.5, words: ['Original', 'refrain'] },
  ]);
  assert.deepEqual(parseLrc('[00:01.00][00:99.00]Bad'), []);
});

test('plain lyrics retain text, provenance, milliseconds and truthful cache metadata', async () => {
  const { resolver, httpClient } = resolverFor(() => response(record()));
  const first = await resolver.resolveLyrics(request);
  assert.equal(first.status, 'found');
  assert.equal(first.text, original);
  assert.equal(first.timing, 'none');
  assert.deepEqual(first.synced, []);
  assert.equal(first.confidence, 'exact');
  assert.equal(first.songInfo.duration, 180000);
  assert.deepEqual(first.requested, request);
  assert.equal(first.source, 'lrclib.net');
  assert.equal(first.sourceUrl, 'https://lrclib.net/api/get/23');
  assert.deepEqual(first.cache, { hit: false, storage: 'memory', persisted: false });
  const second = await resolver.resolveLyrics(request);
  assert.deepEqual(second.cache, { hit: true, storage: 'memory', persisted: false });
  assert.equal(httpClient.calls.length, 1);
});

test('real LRC is line sync; instrumental is terminal and empty', async () => {
  const synced = resolverFor(() => response(record({ plainLyrics: null, syncedLyrics: '[00:03.00]Original line' })));
  const result = await synced.resolver.resolveLyrics(request);
  assert.equal(result.timing, 'line');
  assert.deepEqual(result.synced, [{ time: 3, words: ['Original', 'line'] }]);
  assert.equal(result.text, 'Original line');
  const instrumental = resolverFor(() => response(record({ instrumental: true, plainLyrics: null })));
  const empty = await instrumental.resolver.resolveLyrics(request);
  assert.equal(empty.status, 'instrumental');
  assert.equal(empty.text, '');
  assert.deepEqual(empty.synced, []);
  assert.equal(instrumental.httpClient.calls.length, 1);
});

test('matching rejects wrong title, artist, album, duration and version instead of selecting first synced result', async () => {
  const wrong = [record({ trackName: 'Other Title' }), record({ artistName: 'Other Artist' }),
    record({ albumName: 'Other Album' }), record({ duration: 190 }), record({ trackName: request.title + ' (Live)' })];
  for (const wrongRecord of wrong) {
    const { resolver } = resolverFor((url) => url.hostname === 'api.lyrics.ovh' ? response({}, 404) :
      url.pathname === '/api/get' ? response(wrongRecord) : response([wrongRecord]));
    const result = await resolver.resolveLyrics(request);
    assert.equal(result.status, 'not_found');
    assert.equal(result.text, '');
    assert.equal(result.songInfo, null);
  }
  const { resolver } = resolverFor((url) => url.pathname === '/api/get' ? response({}, 404) : response([
    record({ artistName: 'Other Artist', syncedLyrics: '[00:01.00]Wrong' }), record(),
  ]));
  const result = await resolver.resolveLyrics(request);
  assert.equal(result.status, 'found');
  assert.equal(result.text, original);
  assert.equal(result.confidence, 'matched');
});

test('keyword search is tried after structured absence and still validates recording metadata', async () => {
  const { resolver, httpClient } = resolverFor((url) => url.searchParams.has('q') ? response([record()]) :
    url.pathname === '/api/get' ? response({}, 404) : response([]));
  assert.equal((await resolver.resolveLyrics(request)).status, 'found');
  assert.equal(httpClient.calls.length, 3);
  assert.ok(httpClient.calls[2].url.includes('q='));
});

test('unrequested live albums and ambiguous same-title recordings are rejected conservatively', async () => {
  const ordinary = { title: request.title, artist: request.artist };
  const liveAlbum = resolverFor((url) => url.hostname === 'api.lyrics.ovh' ? response({}, 404) :
    url.pathname === '/api/get' ? response(record({ albumName: 'Live in Fixture Hall' })) :
      response([record({ albumName: 'Live in Fixture Hall' })]));
  assert.equal((await liveAlbum.resolver.resolveLyrics(ordinary)).status, 'not_found');
  const ambiguous = resolverFor((url) => url.hostname === 'api.lyrics.ovh' ? response({}, 404) :
    url.pathname === '/api/get' ? response({}, 404) : response([record(), record({ albumName: 'Other Release', duration: 240,
      syncedLyrics: '[00:01.00]Ambiguous original fixture' })]));
  assert.equal((await ambiguous.resolver.resolveLyrics(ordinary)).status, 'not_found');
});

test('ordinary online fallback remains plain and explicitly title-artist unverified', async () => {
  const { resolver, httpClient } = resolverFor((url) => url.hostname === 'api.lyrics.ovh' ?
    response({ lyrics: original }) : response([], 404));
  const result = await resolver.resolveLyrics(request);
  assert.equal(result.status, 'found');
  assert.equal(result.confidence, 'title-artist');
  assert.equal(result.source, 'lyrics.ovh');
  assert.equal(result.timing, 'none');
  assert.deepEqual(result.synced, []);
  assert.equal(result.songInfo.duration, 0);
  assert.equal(result.songInfo.album, '');
  assert.equal(httpClient.calls.length, 4);
  const fallback = new URL(httpClient.calls[3].url);
  assert.equal(fallback.pathname, '/v1/Fixture%20Ensemble/Paper%20Lantern');
});

test('version-sensitive requests never use identity-unverified lyrics.ovh fallback', async () => {
  for (const title of ['Paper Lantern (Live)', 'Paper Lantern - 2014 Remaster', 'Paper Lantern (Acoustic)',
    'Paper Lantern (DJ Fixture Remix)', 'Paper Lantern - Radio Edit', 'Paper Lantern (Taylor Version)']) {
    const { resolver, httpClient } = resolverFor(() => response([], 404));
    assert.equal((await resolver.resolveLyrics({ ...request, title })).status, 'not_found');
    assert.equal(httpClient.calls.some((call) => call.url.includes('lyrics.ovh')), false);
  }
});

test('mixed provider miss and failure stays unavailable; a later valid result can recover', async () => {
  const missingAndError = resolverFor((url) => url.hostname === 'api.lyrics.ovh' ? response({}, 503) : response([], 404));
  const result = await missingAndError.resolver.resolveLyrics(request);
  assert.equal(result.status, 'unavailable');
  assert.equal(result.confidence, 'none');
  assert.equal(result.text, '');
  const recovered = resolverFor((url) => url.hostname === 'api.lyrics.ovh' ? response({ lyrics: original }) : response({}, 500));
  assert.equal((await recovered.resolver.resolveLyrics(request)).status, 'found');
});

test('429 respects Retry-After and cooldown avoids provider calls until expiry', async () => {
  let clock = Date.now();
  const { resolver, httpClient } = resolverFor(() => response({}, 429, { 'retry-after': '7' }), { now: () => clock });
  const first = await resolver.resolveLyrics(request);
  assert.equal(first.status, 'unavailable');
  assert.equal(first.retryAfter, 7);
  const callCount = httpClient.calls.length;
  const retry = await resolver.resolveLyrics(request);
  assert.equal(retry.status, 'unavailable');
  assert.equal(retry.retryAfter, 7);
  assert.equal(httpClient.calls.length, callCount);
  clock += 7100;
  await resolver.resolveLyrics(request);
  assert.ok(httpClient.calls.length > callCount);
});

test('overall deadline terminates non-cooperating providers and fixed hosts have bounded requests', async () => {
  const started = Date.now();
  const { resolver, httpClient } = resolverFor(() => new Promise(() => {}), { deadlineMs: 70, stageTimeoutMs: 30 });
  const result = await resolver.resolveLyrics(request);
  assert.equal(result.status, 'unavailable');
  assert.ok(Date.now() - started < 400);
  for (const call of httpClient.calls) {
    assert.ok(['lrclib.net', 'api.lyrics.ovh'].includes(new URL(call.url).hostname));
    assert.equal(call.config.maxRedirects, 0);
    assert.ok(call.config.maxContentLength <= 524288);
    assert.ok(call.config.timeout <= 70);
  }
});

test('malformed and oversized upstream bodies are unavailable, never a permanent miss', async () => {
  for (const bad of ['<html>upstream error</html>', { lyrics: 'x'.repeat(530000) }]) {
    const { resolver } = resolverFor(() => response(bad));
    assert.equal((await resolver.resolveLyrics(request)).status, 'unavailable');
  }
});

test('in-flight deduplication, bounded TTL cache and invalid requests', async () => {
  let clock = Date.now();
  const { resolver, httpClient } = resolverFor(async (url) => {
    await new Promise((resolve) => setTimeout(resolve, 4));
    return response(record({ trackName: url.searchParams.get('track_name') }));
  }, { maxEntries: 2, ttlMs: 100, now: () => clock });
  const results = await Promise.all(Array.from({ length: 8 }, () => resolver.resolveLyrics(request)));
  assert.equal(results.length, 8);
  assert.equal(httpClient.calls.length, 1);
  results[0].text = 'mutated outside cache';
  assert.equal((await resolver.resolveLyrics(request)).text, original);
  await resolver.resolveLyrics({ ...request, title: 'Second Fixture' });
  await resolver.resolveLyrics({ ...request, title: 'Third Fixture' });
  assert.equal(resolver.cacheSize(), 2);
  clock += 101;
  await resolver.resolveLyrics(request);
  assert.equal(httpClient.calls.length, 4);
  assert.notEqual(recordingKey(request), recordingKey({ ...request, album: 'Other Album' }));
  assert.notEqual(recordingKey(request), recordingKey({ ...request, duration: 185000 }));
  for (const invalid of [{}, { title: ['bad'], artist: 'A' }, { title: 'T', artist: 'A', duration: '-1' },
    { title: 'T', artist: 'A', duration: 'NaN' }, { title: 'T', artist: 'A', duration: '3600001' }]) {
    assert.throws(() => validateQuery(invalid), /query|duration|title|artist/i);
  }
});

test('deduplicated normalized requests each preserve their own original requested signature', async () => {
  const { resolver, httpClient } = resolverFor(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    return response(record());
  });
  const alternate = { ...request, title: 'PAPER LANTERN' };
  const [first, second] = await Promise.all([resolver.resolveLyrics(request), resolver.resolveLyrics(alternate)]);
  assert.equal(httpClient.calls.length, 1);
  assert.deepEqual(first.requested, request);
  assert.deepEqual(second.requested, alternate);
});

test('cache storage errors are graceful and never claim persistence', async () => {
  const store = { async get() { throw new Error('read failed'); }, async set() { throw new Error('write failed'); } };
  const { resolver } = resolverFor(() => response(record()), { store });
  const result = await resolver.resolveLyrics(request);
  assert.equal(result.status, 'found');
  assert.deepEqual(result.cache, { hit: false, storage: 'memory', persisted: false });
});
