const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { startServer, writeArtifact, summary } = require('./harness.cjs');

async function request(server, query) {
  const requestPath = `/api/lyrics?${new URLSearchParams(query)}`;
  const started = Date.now();
  const response = await fetch(server.url + requestPath, { signal: AbortSignal.timeout(11000) });
  return { response, body: await response.json(), elapsedMs: Date.now() - started, requestPath };
}
(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'oruga-karaoke-smoke-'));
  let first;
  let restarted;
  const evidence = { ok: false, scope: 'Real local HTTP and live public provider; fresh local process with upstream disabled. No cloud durability claim.', queries: [] };
  try {
    first = await startServer({ directory });
    let selected;
    for (const query of [{ title: 'Querida', artist: 'Juan Gabriel' }, { title: 'Yellow', artist: 'Coldplay' }, { title: 'EL TRISTE', artist: 'JOSE JOSE' }]) {
      const row = await request(first, query);
      evidence.queries.push({ query, http: row.response.status, elapsedMs: row.elapsedMs, requestPath: row.requestPath, result: summary(row.body.lyrics || {}) });
      if (row.response.status === 200 && row.body.lyrics?.status === 'found' && row.body.lyrics.text && row.body.lyrics.cache?.persisted) {
        selected = { query, ...row };
        break;
      }
    }
    assert.ok(selected, 'No live public provider returned persistent real lyrics; smoke is blocked');
    const warm = await request(first, selected.query);
    assert.equal(warm.response.status, 200);
    assert.equal(warm.body.lyrics.cache.hit, true);
    assert.ok(warm.body.lyrics.text === selected.body.lyrics.text, 'Warm cache content changed');
    const before = await first.stats();
    await first.close();
    first = null;
    restarted = await startServer({ directory, offline: true });
    const recovered = await request(restarted, selected.query);
    const after = await restarted.stats();
    assert.notEqual(before.pid, after.pid, 'Durability must use a different process PID');
    assert.equal(after.providersDisabled, true);
    assert.equal(after.providerCalls, 0, 'Fresh process must not call providers');
    assert.equal(recovered.response.status, 200);
    assert.deepEqual(recovered.body.lyrics.cache, { hit: true, storage: 'disk', persisted: true });
    assert.ok(recovered.body.lyrics.text === selected.body.lyrics.text, 'Restarted disk cache content changed');
    assert.equal(recovered.body.lyrics.source, selected.body.lyrics.source);
    assert.equal(recovered.body.lyrics.sourceUrl, selected.body.lyrics.sourceUrl);
    evidence.warm = { http: warm.response.status, elapsedMs: warm.elapsedMs, result: summary(warm.body.lyrics) };
    evidence.restart = { before, after, http: recovered.response.status, elapsedMs: recovered.elapsedMs, result: summary(recovered.body.lyrics), contentSha256: crypto.createHash('sha256').update(recovered.body.lyrics.text).digest('hex') };
    evidence.ok = true;
  } catch (error) {
    evidence.error = error.message;
    process.exitCode = 1;
  } finally {
    await first?.close();
    await restarted?.close();
    // Verify the absolute mkdtemp target before recursive removal on Windows.
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('oruga-karaoke-smoke-'));
    await fs.rm(directory, { recursive: true, force: true });
    writeArtifact('smoke.json', evidence);
    console.log(JSON.stringify(evidence));
  }
  process.exit(process.exitCode || 0);
})().catch(error => { console.error(error.message); process.exit(1); });
