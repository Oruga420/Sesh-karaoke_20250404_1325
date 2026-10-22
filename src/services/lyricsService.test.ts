import { CACHE_MAX_ENTRIES, CACHE_TTL_MS, DEVICE_CACHE_KEY, exportLyricsJson, fetchLyrics, getLastSavedLyrics,
  getSavedLyrics, importLyricsJson, LyricsRequestError, MAX_JSON_BYTES, recordingKey, saveLyricsOnDevice, validateLyrics } from './lyricsService';
import { fixtureLyrics, fixtureRecording, fixtureResponse, deferred } from './lyricsTestFixtures';

let request: jest.Mock;
beforeEach(() => {
  localStorage.clear();
  request = jest.fn(); global.fetch = request;
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

it('preserves real plain text, sends the complete recording, and records actual device save independently', async () => {
  const lyrics = fixtureLyrics({ cache: { hit: true, storage: 'disk', persisted: true } });
  request.mockResolvedValue(fixtureResponse(lyrics));
  const result = await fetchLyrics(fixtureRecording);
  expect(result.lyrics).toEqual(lyrics);
  expect(result).toMatchObject({ savedOnDevice: true, fromDevice: false });
  const url = new URL(request.mock.calls[0][0], 'https://fixture.test');
  expect(url.pathname).toBe('/api/lyrics');
  expect(Object.fromEntries(url.searchParams)).toEqual({ title: fixtureRecording.title, artist: fixtureRecording.artist, album: fixtureRecording.album, duration: '180000' });
});

it('consumes typed404 absence without invented lyric text, timings, or negative persistence', async () => {
  const missing = fixtureLyrics({ status: 'not_found', text: '', songInfo: null, source: null, sourceUrl: null, confidence: 'none' });
  request.mockResolvedValue(fixtureResponse(missing, 404));
  expect(await fetchLyrics(fixtureRecording)).toMatchObject({ lyrics: { status: 'not_found', timing: 'none', text: '', synced: [] }, savedOnDevice: false });
  expect(localStorage.getItem(DEVICE_CACHE_KEY)).toBeNull();
});

it('keeps typed503 temporary failure and Retry-After distinct from absence', async () => {
  const unavailable = fixtureLyrics({ status: 'unavailable', text: '', songInfo: null, source: null, sourceUrl: null, confidence: 'none' });
  request.mockResolvedValue(fixtureResponse(unavailable, 503, '3'));
  expect(await fetchLyrics(fixtureRecording)).toMatchObject({ lyrics: { status: 'unavailable', retryAfter: 3 }, savedOnDevice: false });
});

it('rejects malformed and mismatched response contracts without converting them into successful lyrics', async () => {
  request.mockResolvedValue(fixtureResponse(fixtureLyrics({ requested: { ...fixtureRecording, album: 'Another recording' } })));
  await expect(fetchLyrics(fixtureRecording)).rejects.toBeInstanceOf(LyricsRequestError);
  request.mockResolvedValue({ status: 200, headers: { get: () => null }, text: async () => '<html>failure</html>' });
  await expect(fetchLyrics(fixtureRecording)).rejects.toThrow('invalid response');
});

it('reuses JSON after an offline reload without contacting the API', async () => {
  const original = fixtureLyrics();
  expect(saveLyricsOnDevice(original)).toBe(true);
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  expect(getLastSavedLyrics()?.lyrics).toEqual(original);
  expect(await fetchLyrics(fixtureRecording, { bypassCache: true })).toMatchObject({ lyrics: original, fromDevice: true, savedOnDevice: true });
  expect(request).not.toHaveBeenCalled();
});

it('reports an honest offline state for an uncached recording', async () => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  await expect(fetchLyrics(fixtureRecording)).rejects.toMatchObject({ offline: true });
  expect(request).not.toHaveBeenCalled();
});

it('separates recordings by album, duration, and track ID', () => {
  saveLyricsOnDevice(fixtureLyrics());
  for (const change of [{ album: 'Live album' }, { duration: 181000 }, { trackId: 'fixture-track-id' }]) {
    expect(getSavedLyrics({ ...fixtureRecording, ...change })).toBeNull();
    expect(recordingKey({ ...fixtureRecording, ...change })).not.toBe(recordingKey(fixtureRecording));
  }
});

it('expires saved data without extending the original retrieval date during export/import', () => {
  jest.useFakeTimers();
  const original = fixtureLyrics();
  const json = exportLyricsJson(original);
  expect(importLyricsJson(json).lyrics.fetchedAt).toBe(original.fetchedAt);
  jest.advanceTimersByTime(CACHE_TTL_MS + 1);
  expect(getSavedLyrics(original.requested)).toBeNull();
  expect(importLyricsJson(json)).toMatchObject({ savedOnDevice: false, lyrics: { fetchedAt: original.fetchedAt } });
});

it('bounds the device cache and evicts older entries gracefully', () => {
  jest.useFakeTimers();
  for (let index = 0; index < CACHE_MAX_ENTRIES + 4; index += 1) {
    jest.advanceTimersByTime(1);
    saveLyricsOnDevice(fixtureLyrics({ requested: { ...fixtureRecording, title: `Synthetic ${index}` }, songInfo: { ...fixtureRecording, title: `Synthetic ${index}` } }));
  }
  const stored = JSON.parse(localStorage.getItem(DEVICE_CACHE_KEY)!);
  expect(stored.entries).toHaveLength(CACHE_MAX_ENTRIES);
  expect(getSavedLyrics({ ...fixtureRecording, title: 'Synthetic 0' })).toBeNull();
  localStorage.removeItem(DEVICE_CACHE_KEY);
  expect(getLastSavedLyrics()).toBeNull();
});

it('recovers from corrupt, oversized, and invalid saved JSON', () => {
  for (const raw of ['{broken', JSON.stringify({ version: 7, entries: [] }), 'x'.repeat(MAX_JSON_BYTES + 1)]) {
    localStorage.setItem(DEVICE_CACHE_KEY, raw);
    expect(getLastSavedLyrics()).toBeNull();
    expect(localStorage.getItem(DEVICE_CACHE_KEY)).toBeNull();
  }
});

it('handles quota or disabled storage without claiming backend disk data is saved on the device', async () => {
  request.mockResolvedValue(fixtureResponse(fixtureLyrics({ cache: { hit: true, storage: 'disk', persisted: true } })));
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota', 'QuotaExceededError'); });
  expect(await fetchLyrics(fixtureRecording)).toMatchObject({ savedOnDevice: false, lyrics: { status: 'found', cache: { persisted: true } } });
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage disabled'); });
  expect(getLastSavedLyrics()).toBeNull();
});

it('preserves requested and returned metadata, attribution, and retrieval time across export/import', () => {
  const original = fixtureLyrics({ confidence: 'title-artist', source: 'lyrics.ovh', sourceUrl: 'https://api.lyrics.ovh/v1/fixture/song', songInfo: { ...fixtureRecording, album: '', duration: 0 } });
  const copy = importLyricsJson(exportLyricsJson(original));
  expect(copy.lyrics).toEqual(original);
  expect(copy.savedOnDevice).toBe(true);
  expect(copy.imported).toBe(true);
  expect(getLastSavedLyrics()?.imported).toBe(true);
  expect(request).not.toHaveBeenCalled();
});

it('validates imported schema, size, timing, and source URLs without fetching supplied links', () => {
  expect(() => importLyricsJson('x'.repeat(MAX_JSON_BYTES + 1))).toThrow('smaller than 1 MB');
  expect(() => importLyricsJson('{broken')).toThrow('valid lyrics JSON');
  expect(() => importLyricsJson(JSON.stringify({ version: 2, lyrics: fixtureLyrics() }))).toThrow('Unsupported');
  expect(validateLyrics(fixtureLyrics({ timing: 'none', synced: [{ time: 0, words: ['Synthetic'] }] }))).toBeNull();
  expect(validateLyrics(fixtureLyrics({ timing: 'line', synced: [{ time: 4, words: ['Synthetic'] }, { time: 1, words: ['Backward'] }] }))).toBeNull();
  // eslint-disable-next-line no-script-url -- Untrusted JSON URLs must never become executable source links.
  expect(validateLyrics(fixtureLyrics({ sourceUrl: 'javascript:alert(1)' }))).toBeNull();
  expect(validateLyrics(fixtureLyrics({ sourceUrl: 'https://user:pass@fixture.test/' }))).toBeNull();
  expect(request).not.toHaveBeenCalled();
});

it.each([
  ['unrelated recording', { songInfo: { ...fixtureRecording, title: 'Entirely different song' } }],
  ['unattributed instrumental', { status: 'instrumental', text: '', songInfo: null, source: null, sourceUrl: null, confidence: 'none' }],
  ['unrelated HTTPS source host', { sourceUrl: 'https://unrelated.invalid/track' }],
  ['wrong source confidence', { confidence: 'title-artist' }],
  ['wrong recording duration', { songInfo: { ...fixtureRecording, duration: fixtureRecording.duration + 3000 } }],
  ['unspecified live version', { requested: { ...fixtureRecording, album: '' }, songInfo: { ...fixtureRecording, album: 'Live edition' } }],
] as const)('rejects imported %s instead of saving false provenance', (_description, change) => {
  const value = { ...fixtureLyrics(), ...change };
  expect(validateLyrics(value)).toBeNull();
  expect(() => importLyricsJson(JSON.stringify({ version: 1, lyrics: value }))).toThrow('Unsupported');
  expect(getLastSavedLyrics()).toBeNull();
});

it('does not persist an aborted response even when the transport ignores cancellation', async () => {
  const pending = deferred<Response>();
  request.mockReturnValue(pending.promise);
  const controller = new AbortController();
  const result = fetchLyrics(fixtureRecording, { signal: controller.signal });
  controller.abort(); pending.resolve(fixtureResponse(fixtureLyrics()));
  await expect(result).rejects.toMatchObject({ name: 'AbortError' });
  expect(getLastSavedLyrics()).toBeNull();
});

it('aborts the transport at the request deadline and distinguishes a timeout', async () => {
  jest.useFakeTimers();
  request.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  const result = fetchLyrics(fixtureRecording);
  jest.advanceTimersByTime(10000);
  await expect(result).rejects.toThrow('timed out');
});
