const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const Ajv = require('ajv');
const { createResolver } = require('../lib/lyricsResolver');
const { writeArtifact, summary, root } = require('./harness.cjs');

const load = filename => JSON.parse(fs.readFileSync(path.join(root, 'artifacts/baseline', filename), 'utf8'));
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function classify(expected, result) {
  if (result.status !== 'found' && result.status !== 'instrumental') return result.status === 'not_found' ? 'not-found' : 'temporarily-unavailable';
  if (result.confidence === 'title-artist') return 'unverified-title-artist-text-retrieval';
  if (!result.songInfo || !['exact', 'matched'].includes(result.confidence)) return 'unverifiable-recording';
  const actual = result.songInfo;
  if (normalize(actual.title) !== normalize(expected.title) || normalize(actual.artist) !== normalize(expected.artist) ||
    normalize(actual.album) !== normalize(expected.album) || Math.abs(Number(actual.duration) - Number(expected.duration)) > 3000) return 'wrong-recording';
  const state = result.status === 'instrumental' ? 'instrumental' : result.timing === 'line' ? 'synced' : 'plain';
  return state === expected.lyricState ? 'correct-recording-and-lyric-state' : 'recording-match-with-changed-lyric-state';
}
async function deterministic() {
  const before = load('resolver-behavior.json');
  const request = { title: 'Fixture', artist: 'Fixture Artist', album: 'Fixture Album', duration: 180000 };
  const original = 'Original first line\nOriginal second line';
  const matching = { id: 101, trackName: request.title, artistName: request.artist, albumName: request.album, duration: 180, instrumental: false, plainLyrics: original, syncedLyrics: null };
  const cases = [
    { name: 'plain-only', expected: 'real-plain-preserved-without-synthetic-times', get: () => ({ status: 200, data: matching }), verify: result => result.status === 'found' && result.text === original && result.timing === 'none' && result.synced.length === 0 },
    { name: 'instrumental', expected: 'terminal-instrumental-without-synthetic-text-or-times', get: () => ({ status: 200, data: { ...matching, instrumental: true, plainLyrics: null } }), verify: result => result.status === 'instrumental' && result.text === '' && result.synced.length === 0 },
    { name: 'wrong-search-version', expected: 'reject-different-title-artist-and-live-recording', get: url => ({ status: new URL(url).pathname === '/api/get' || url.includes('lyrics.ovh') ? 404 : 200, data: url.includes('lyrics.ovh') ? {} : [{ trackName: 'Different Song (Live)', artistName: 'Different Artist', duration: 900, plainLyrics: 'Unrelated words', syncedLyrics: '[00:01.00]Unrelated words' }] }), verify: result => result.status === 'not_found' && result.text === '' && result.synced.length === 0 },
  ];
  const rows = [];
  for (const fixture of cases) {
    const resolver = createResolver({ httpClient: { get: async url => fixture.get(url) }, requestDelayMs: 0 });
    const result = await resolver.resolveLyrics(request);
    const correct = fixture.verify(result);
    rows.push({ case: fixture.name, evidence: 'deterministic original synthetic fixture, not live coverage', requested: request, expectedCorrectnessClass: fixture.expected, before: before.rows.find(row => row.case === fixture.name), after: summary(result), classification: correct ? 'corrected-demonstrated-defect' : 'regression-still-fails' });
    assert.ok(correct, `Deterministic case failed: ${fixture.name}`);
  }
  return rows;
}
(async () => {
  const report = { schemaVersion: 1, ok: false, measuredAt: new Date().toISOString(), scope: 'Eight frozen catalog-selected diagnostic requests. Not a representative repertoire sample; no overall coverage percentage.', deterministic: [], live: [] };
  try {
    report.deterministic = await deterministic();
    const baseline = load('live-before.json');
    const catalog = load('catalog-sample.json');
    assert.equal(baseline.rows.length, 8);
    const resolver = createResolver();
    for (const before of baseline.rows) {
      const frozen = catalog.rows.find(row => row.record?.id === before.catalogId)?.record;
      assert.ok(frozen, 'Frozen expected metadata missing');
      const expected = { catalogId: frozen.id, title: frozen.title, artist: frozen.artist, album: frozen.album, duration: frozen.duration, lyricState: frozen.hasSynced ? 'synced' : frozen.hasPlain ? 'plain' : 'instrumental' };
      const started = Date.now();
      const result = await resolver.resolveLyrics(before.query);
      report.live.push({
        requested: before.query,
        expectedCorrectnessClass: 'matching-frozen-recording-metadata-and-lyric-state',
        expected,
        before: { ...before, returnedMatchedMetadata: null, classification: before.synthetic ? 'synthetic-placeholder' : 'recording-unverifiable-in-frozen-baseline' },
        after: { elapsedMs: Date.now() - started, returnedMatchedMetadata: result.songInfo, ...summary(result), classification: classify(expected, result) },
      });
    }
    report.summary = {
      deterministicDefectsCorrected: report.deterministic.length,
      liveRequests: report.live.length,
      baselineRealResponses: baseline.rows.filter(row => !row.synthetic).length,
      baselineSyntheticResponses: baseline.rows.filter(row => row.synthetic).length,
      measuredCorrectRecordingAndState: report.live.filter(row => row.after.classification === 'correct-recording-and-lyric-state').length,
      unverifiedTextRetrievals: report.live.filter(row => row.after.classification === 'unverified-title-artist-text-retrieval').length,
      wrongRecordings: report.live.filter(row => row.after.classification === 'wrong-recording').length,
      note: 'Counts describe these selected requests only. Title/artist-only fallback is unverified text retrieval. No verified live improvement count is inferred from baseline responses lacking returned metadata.',
    };
    assert.equal(report.summary.wrongRecordings, 0, 'Resolver accepted a wrong live recording');
    report.ok = true;
    const validate = new Ajv({ allErrors: true }).compile(require('./benchmark.schema.json'));
    assert.ok(validate(report), `Benchmark artifact schema invalid: ${JSON.stringify(validate.errors)}`);
    report.schemaValidated = true;
  } catch (error) { report.ok = false; report.error = error.message; }
  writeArtifact('benchmark.json', report);
  console.log(JSON.stringify(report));
  process.exit(report.ok ? 0 : 1);
})();
