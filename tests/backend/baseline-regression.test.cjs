const { test } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

async function invoke(query, upstream) {
  const original = axios.get;
  axios.get = async (url) => typeof upstream === 'function' ? upstream(url) : upstream;
  delete require.cache[require.resolve('../../api/lyrics')];
  const handler = require('../../api/lyrics');
  let status = 200;
  let body;
  const res = {
    setHeader() {},
    status(value) { status = value; return this; },
    json(value) { body = value; return this; },
    end() { return this; },
  };
  try {
    await handler({ method: 'GET', query }, res);
    return { status, body };
  } finally {
    axios.get = original;
    delete require.cache[require.resolve('../../api/lyrics')];
  }
}

test('regression: genuine plain lyrics survive the public handler', async () => {
  const query = { title: 'Paper Lantern', artist: 'Fixture Ensemble', album: 'Original Fixture', duration: '180000' };
  const result = await invoke(query, { status: 200, data: {
    trackName: query.title, artistName: query.artist, albumName: query.album, duration: 180,
    plainLyrics: 'An original lantern crosses the bay.\nWe follow its glow until day.', syncedLyrics: null,
  } });
  assert.equal(result.status, 200);
  assert.equal(result.body.lyrics.status, 'found');
  assert.equal(result.body.lyrics.timing, 'none');
  assert.equal(result.body.lyrics.text, 'An original lantern crosses the bay.\nWe follow its glow until day.');
  assert.deepEqual(result.body.lyrics.synced, []);
});

test('regression: a genuine instrumental has no fabricated lyric lines', async () => {
  const query = { title: 'Quiet Fixture', artist: 'Fixture Ensemble' };
  const result = await invoke(query, { status: 200, data: {
    trackName: query.title, artistName: query.artist, instrumental: true, plainLyrics: null, syncedLyrics: null,
  } });
  assert.equal(result.body.lyrics.status, 'instrumental');
  assert.equal(result.body.lyrics.text, '');
  assert.deepEqual(result.body.lyrics.synced, []);
});

test('regression: search cannot substitute a different artist/title/live recording', async () => {
  const query = { title: 'Paper Lantern (Live)', artist: 'Fixture Ensemble', duration: '180000' };
  const result = await invoke(query, (url) => new URL(url).pathname === '/api/get' ? { status: 404 } : { status: 200, data: [{
    trackName: 'Wrong Parade', artistName: 'Other Band', duration: 220,
    plainLyrics: 'This fixture must never be accepted.', syncedLyrics: '[00:01.00]Wrong fixture',
  }] });
  assert.equal(result.status, 404);
  assert.equal(result.body.lyrics.status, 'not_found');
  assert.equal(result.body.lyrics.text, '');
  assert.deepEqual(result.body.lyrics.synced, []);
});
