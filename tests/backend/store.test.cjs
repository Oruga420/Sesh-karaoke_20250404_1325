const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const { createJsonStore } = require('../../lib/lyricsStore');
const { createResolver, recordingKey } = require('../../lib/lyricsResolver');
const { isLyricsResult } = require('../../lib/lyricsContract');

const runFile = promisify(execFile);
const query = { title: 'Stored Lantern', artist: 'Fixture Ensemble', album: 'Original Fixture', duration: 180000 };
function fixture(request = query, text = 'Original stored lantern carries a light.') {
  return { status: 'found', timing: 'none', text, synced: [], source: 'lrclib.net',
    sourceUrl: 'https://lrclib.net/api/get/22', songInfo: { ...request }, requested: { ...request },
    confidence: 'exact', fetchedAt: new Date().toISOString(), cache: { hit: false, storage: 'memory', persisted: false } };
}
async function directory(t) {
  const result = await fs.mkdtemp(path.join(os.tmpdir(), 'oruga-lyrics-test-'));
  t.after(() => fs.rm(result, { recursive: true, force: true }));
  return result;
}

test('JSON survives a real HTTP restart in a distinct PID while all upstream calls are disabled', async (t) => {
  const root = await directory(t);
  const child = path.join(__dirname, 'fixtures', 'cache-process.cjs');
  const first = JSON.parse((await runFile(process.execPath, [child, root, 'write'], { timeout: 30000 })).stdout);
  const second = JSON.parse((await runFile(process.execPath, [child, root, 'read'], { timeout: 30000 })).stdout);
  assert.notEqual(first.pid, second.pid);
  assert.equal(first.httpStatus, 200);
  assert.equal(first.calls, 1);
  assert.equal(first.cache.persisted, true);
  assert.equal(second.httpStatus, 200);
  assert.equal(second.calls, 0);
  assert.deepEqual(second.cache, { hit: true, storage: 'disk', persisted: true });
  assert.equal(second.source, first.source);
  assert.equal(second.sourceUrl, first.sourceUrl);
  assert.equal(second.textHash, first.textHash);
});

test('concurrent writes to distinct recording keys retain every valid JSON file', async (t) => {
  const root = await directory(t);
  const store = createJsonStore({ directory: root });
  const requests = Array.from({ length: 10 }, (_, index) => ({ ...query, title: 'Stored Lantern ' + index }));
  assert.deepEqual(await Promise.all(requests.map((request) => store.set(recordingKey(request), fixture(request)))), Array(10).fill(true));
  const entries = await Promise.all(requests.map((request) => store.get(recordingKey(request))));
  assert.ok(entries.every((entry, index) => entry.requested.title === requests[index].title));
  assert.equal((await fs.readdir(root)).filter((name) => name.endsWith('.json')).length, 10);
  assert.equal((await fs.readdir(root)).some((name) => name.endsWith('.tmp')), false);
});

test('failed atomic rename or write preserves the previous valid JSON exactly', async (t) => {
  const root = await directory(t);
  const key = recordingKey(query);
  const store = createJsonStore({ directory: root });
  const previous = fixture();
  assert.equal(await store.set(key, previous), true);
  const filename = path.join(root, key + '.json');
  const oldBytes = await fs.readFile(filename, 'utf8');
  for (const operation of ['rename', 'writeFile']) {
    const failingFs = { ...fs, async [operation]() { throw new Error('Intentional storage fixture failure'); } };
    const failing = createJsonStore({ directory: root, fs: failingFs });
    assert.equal(await failing.set(key, fixture(query, 'Replacement must not overwrite on failure.')), false);
    assert.equal(await fs.readFile(filename, 'utf8'), oldBytes);
    assert.deepEqual(await store.get(key), previous);
    assert.equal((await fs.readdir(root)).some((name) => name.endsWith('.tmp')), false);
  }
});

test('corrupt, expired, wrong-key, unsafe-source and oversized disk records are ignored', async (t) => {
  const root = await directory(t);
  const store = createJsonStore({ directory: root });
  const key = recordingKey(query);
  const filename = path.join(root, key + '.json');
  const entry = { schemaVersion: 1, key, expiresAt: Date.now() + 60000, lyrics: fixture() };
  for (const content of ['{corrupt', JSON.stringify({ ...entry, expiresAt: 1 }),
    JSON.stringify({ ...entry, key: 'f'.repeat(64) }),
    JSON.stringify({ ...entry, lyrics: fixture({ ...query, title: 'Different Recording' }) }),
    JSON.stringify({ ...entry, lyrics: { ...fixture(), sourceUrl: 'https://untrusted.invalid/file' } }),
    JSON.stringify({ ...entry, lyrics: { ...fixture(), text: 'x'.repeat(530000) } })]) {
    await fs.writeFile(filename, content);
    assert.equal(await store.get(key), null);
  }
  assert.equal(await store.get('../escape'), null);
  assert.equal(await store.set('../escape', fixture()), false);
});

test('validates recording identity, sorted timestamps and attribution before disk persistence', async (t) => {
  const store = createJsonStore({ directory: await directory(t) });
  const key = recordingKey(query);
  const valid = fixture();
  assert.equal(isLyricsResult(valid, key), true);
  for (const invalid of [{ ...valid, songInfo: { ...query, duration: 190000 } },
    { ...valid, source: 'lyrics.ovh', confidence: 'exact' },
    { ...valid, status: 'instrumental' },
    { ...valid, timing: 'line', synced: [{ time: 2, words: ['Original'] }, { time: 1, words: ['Line'] }] }]) {
    assert.equal(await store.set(key, invalid), false);
  }
});

test('unwritable JSON storage stays graceful and memory cache claims persisted false', async (t) => {
  const root = await directory(t);
  const blocked = path.join(root, 'a-file-not-a-directory');
  await fs.writeFile(blocked, 'storage fixture');
  const resolver = createResolver({ store: createJsonStore({ directory: blocked }), requestDelayMs: 0,
    httpClient: { async get() { return { status: 200, data: { id: 22, trackName: query.title,
      artistName: query.artist, albumName: query.album, duration: 180, plainLyrics: fixture().text } }; } } });
  const result = await resolver.resolveLyrics(query);
  assert.equal(result.status, 'found');
  assert.deepEqual(result.cache, { hit: false, storage: 'memory', persisted: false });
  assert.deepEqual((await resolver.resolveLyrics(query)).cache, { hit: true, storage: 'memory', persisted: false });
});
