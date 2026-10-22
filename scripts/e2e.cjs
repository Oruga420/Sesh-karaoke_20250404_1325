const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { createApp } = require('../server/server');
const { launchBrowser, closeBrowser } = require('./browser-runtime.cjs');
const { root, writeArtifact, startServer } = require('./harness.cjs');

const storageKey = 'oruga-karaoke.lyrics.v1';
const screenshots = path.join(root, 'artifacts/screenshots');
const preflightPath = path.join(root, 'artifacts/browser-preflight.json');
const evidence = { ok: false, measuredAt: new Date().toISOString(), scope: 'One unintercepted live browser/API/provider lookup plus separate synthetic fixture browser scenarios. Spotify owner authorization/playback remains unverified.', scenarios: [], screenshots: [] };
function fixtureLyrics(query, options = {}) {
  const requested = { title: query.title || 'Plain Fixture', artist: query.artist || 'Fixture Ensemble', album: query.album || '', duration: Number(query.duration) || 0, ...(query.trackId ? { trackId: query.trackId } : {}) };
  const status = options.status || 'found';
  const found = status === 'found';
  const success = found || status === 'instrumental';
  const timing = found && options.synced ? 'line' : 'none';
  return {
    status, timing,
    text: found ? options.synced ? 'Original opening\nOriginal ending' : 'An original lantern crosses the bay.\n<img src=x onerror="window.fixtureInjection=true">\nWe follow its glow until day.' : '',
    synced: timing === 'line' ? [{ time: 0, words: ['Original', 'opening'] }, { time: 5, words: ['Original', 'ending'] }] : [],
    source: success ? 'lrclib.net' : null, sourceUrl: success ? 'https://lrclib.net/api/get/101' : null,
    songInfo: success ? requested : null, requested,
    confidence: success ? 'exact' : 'none', fetchedAt: new Date().toISOString(),
    cache: { hit: false, storage: 'memory', persisted: false },
    ...(options.retryAfter ? { retryAfter: options.retryAfter } : {}),
  };
}
async function fixtureServer() {
  const calls = [];
  const counts = new Map();
  const resolver = { async resolveLyrics(query) {
    calls.push({ title: query.title, time: Date.now() });
    const count = (counts.get(query.title) || 0) + 1; counts.set(query.title, count);
    if (query.title === 'Missing Fixture') return fixtureLyrics(query, { status: 'not_found' });
    if (query.title === 'Retry Fixture' && count === 1) return fixtureLyrics(query, { status: 'unavailable', retryAfter: 2 });
    if (query.title === 'Unavailable Fixture') return fixtureLyrics(query, { status: 'unavailable' });
    if (query.title === 'Instrumental Fixture') return fixtureLyrics(query, { status: 'instrumental' });
    return fixtureLyrics(query, { synced: query.title === 'Synced Fixture' });
  } };
  const server = http.createServer(createApp({ resolver, buildDir: path.join(root, 'build'), serveFrontend: true }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, calls, async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}
function observe(page, expectedHttpErrors = false) {
  const observed = { requests: [], pageErrors: [], consoleErrors: [], expectedNetworkDiagnostics: [] };
  page.on('pageerror', error => observed.pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const detail = { text: message.text(), url: message.location().url };
    if (expectedHttpErrors && /Failed to load resource/.test(detail.text) && (detail.url.includes('/api/lyrics') || /^https:\/\/(?:api\.spotify\.com|accounts\.spotify\.com)\//.test(detail.url))) observed.expectedNetworkDiagnostics.push(detail);
    else observed.consoleErrors.push(detail);
  });
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.pathname === '/api/lyrics') observed.requests.push({ origin: url.origin, path: `${url.pathname}${url.search}`, status: response.status() });
  });
  return observed;
}
async function returnToSearch(page, keyboard = false) {
  const back = page.getByRole('button', { name: 'Buscar otra canción', exact: true });
  if (keyboard) { await back.focus(); await page.keyboard.press('Enter'); }
  else await back.click();
  await page.locator('form[aria-label="Buscar letras"]').waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'lyrics-title', 'Returning to search did not restore title focus');
}
async function search(page, title, artist = 'Fixture Ensemble', album = '') {
  const form = page.locator('form[aria-label="Buscar letras"]');
  if (!await form.isVisible()) await returnToSearch(page);
  await page.locator('#lyrics-title').fill(title);
  await page.locator('#lyrics-artist').fill(artist);
  const albumInput = page.locator('#lyrics-album');
  if (await albumInput.inputValue() !== album) {
    if (!await albumInput.isVisible()) await page.getByText('Añadir álbum, opcional', { exact: true }).click();
    await albumInput.fill(album);
  }
  await page.getByRole('button', { name: 'Buscar letras', exact: true }).click();
}
async function reading(page) {
  await page.getByRole('button', { name: 'Buscar otra canción', exact: true }).waitFor({ state: 'visible' });
  assert.equal(await page.locator('#song-search').isVisible(), false, 'Finder remained visible during reading');
  assert.equal(await page.locator('#lyrics-title').count(), 1, 'Reading discarded or duplicated the search form');
  assert.equal(await page.locator('h1').count(), 1, 'Page has more than one primary heading');
}
async function sourceDetails(page) {
  const summary = page.locator('summary').filter({ hasText: 'Fuente, tiempos y archivo' });
  if (await summary.locator('..').getAttribute('open') === null) await summary.click();
}
async function importDetails(page) {
  const summary = page.locator('summary').filter({ hasText: 'Importar letras JSON' });
  if (await summary.locator('..').getAttribute('open') === null) await summary.click();
}
async function state(page, value, timeout = 12000) {
  await page.locator(`[data-testid="lyrics-result"][data-state="${value}"]`).waitFor({ state: 'visible', timeout });
}
async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'Horizontal overflow');
}
async function measureSearchLayout(page) {
  const heading = page.getByRole('heading', { name: 'Busca tu canción', exact: true });
  const layout = await heading.evaluate(element => ({ searchHeadingTop: element.getBoundingClientRect().top, viewportHeight: window.innerHeight, viewportWidth: window.innerWidth }));
  const submit = await page.getByRole('button', { name: 'Buscar letras', exact: true }).boundingBox();
  assert.ok(layout.searchHeadingTop >= 0 && layout.searchHeadingTop < layout.viewportHeight, 'Finder heading is outside the initial viewport');
  assert.ok(submit && submit.y >= 0 && submit.y + submit.height <= layout.viewportHeight, 'Manual search requires scrolling before it can be submitted');
  assert.equal(await page.locator('h1').count(), 1, 'Initial page has more than one primary heading');
  assert.equal(await page.getByRole('button', { name: 'Conectar Spotify', exact: true }).isVisible(), true, 'Optional Spotify connection is unavailable');
  return { ...layout, submitTop: submit.y, submitBottom: submit.y + submit.height, primaryHeadingCount: 1 };
}
async function capture(page, filename, fullPage = true) {
  await noOverflow(page);
  await page.screenshot({ path: path.join(screenshots, filename), fullPage });
  evidence.screenshots.push(`artifacts/screenshots/${filename}`);
}
function clean(observed) {
  assert.deepEqual(observed.pageErrors, [], 'Browser page error');
  assert.deepEqual(observed.consoleErrors, [], 'Unexpected browser console error');
}
(async () => {
  let browser;
  let live;
  let fixtures;
  try {
    if (!fs.existsSync(preflightPath)) throw new Error('Run node scripts/browser-preflight.cjs first; no browser is downloaded automatically.');
    const preflight = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));
    assert.equal(preflight.ok, true, 'Existing browser preflight is not green');
    if (!fs.existsSync(path.join(root, 'build/index.html'))) throw new Error('Run npm run build before browser verification');
    fs.mkdirSync(screenshots, { recursive: true });
    const runtime = await launchBrowser(preflight.executablePath);
    browser = runtime.browser;
    evidence.runtime = { modulePath: runtime.modulePath, executablePath: runtime.executablePath, browserPid: runtime.browserPid, launchTimeoutMs: runtime.launchTimeoutMs, browserVersion: browser.version() };
    live = await startServer({ serveFrontend: true });
    const liveContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'allow', reducedMotion: 'reduce', acceptDownloads: true });
    const livePage = await liveContext.newPage();
    const liveObserved = observe(livePage);
    await livePage.goto(live.url, { waitUntil: 'domcontentloaded' });
    await livePage.getByRole('heading', { name: 'Busca tu canción', exact: true }).waitFor({ state: 'visible' });
    await livePage.locator('.login').waitFor({ state: 'visible' });
    evidence.layout = { desktop: await measureSearchLayout(livePage) };
    await capture(livePage, 'finder-desktop.png', false);
    await livePage.setViewportSize({ width: 390, height: 844 });
    evidence.layout.mobile = await measureSearchLayout(livePage);
    await capture(livePage, 'finder-mobile.png', false);
    await livePage.setViewportSize({ width: 1440, height: 1000 });
    // No lyric API route interception is registered for this scenario.
    let liveResult;
    let liveStoredLyrics;
    for (const request of [{ title: 'Yellow', artist: 'Coldplay' }, { title: 'Querida', artist: 'Juan Gabriel' }]) {
      await search(livePage, request.title, request.artist);
      await livePage.waitForFunction(() => !['idle', 'loading'].includes(document.querySelector('[data-testid="lyrics-result"]')?.getAttribute('data-state') || 'loading'), null, { timeout: 13000 });
      const resultState = await livePage.getByTestId('lyrics-result').getAttribute('data-state');
      if (resultState === 'plain' || resultState === 'synced') {
        const cache = await livePage.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}'), storageKey);
        const lyrics = cache.entries?.[0]?.lyrics;
        assert.ok(lyrics?.text?.length > 0, 'Live lyrics were not saved to device JSON');
        assert.equal(lyrics.requested.title, request.title);
        assert.equal(lyrics.requested.artist, request.artist);
        assert.ok(['lrclib.net', 'lyrics.ovh'].includes(lyrics.source));
        assert.equal(await livePage.getByTestId('lyrics-source').getAttribute('href'), lyrics.sourceUrl);
        assert.match(await livePage.getByTestId('device-save-status').innerText(), /^Guardada en este dispositivo/);
        await reading(livePage);
        if (resultState === 'plain') assert.ok(await livePage.getByTestId('plain-lyrics').textContent() === lyrics.text, 'Live rendered plain text differs from retrieved device JSON');
        else assert.ok(JSON.stringify(await livePage.locator('.lyrics__line').allTextContents()) === JSON.stringify(lyrics.synced.map(line => line.words.join(' '))), 'Live rendered lines differ from retrieved device JSON');
        liveStoredLyrics = lyrics;
        liveResult = { requested: request, state: resultState, source: lyrics.source, sourceUrl: lyrics.sourceUrl, returned: lyrics.songInfo, confidence: lyrics.confidence, textCharacters: lyrics.text.length, contentSha256: crypto.createHash('sha256').update(lyrics.text).digest('hex'), deviceEntries: cache.entries.length, fetchedAt: lyrics.fetchedAt };
        break;
      }
    }
    assert.ok(liveResult, 'No unintercepted browser lookup reached a real public lyric result');
    assert.ok(liveObserved.requests.some(request => request.origin === live.url && request.path.startsWith('/api/lyrics?') && request.status === 200), 'Live lookup did not use the configured local API origin');
    const liveServerStats = await live.stats();
    assert.ok(liveServerStats.providerCalls > 0, 'Unintercepted browser lookup did not call a live public provider');
    evidence.liveAttempt = { localApiOrigin: live.url, providerStats: liveServerStats, result: liveResult, ...structuredClone(liveObserved) };
    await capture(livePage, 'live-desktop.png', false);
    await livePage.getByTestId('lyrics-source').scrollIntoViewIfNeeded();
    await capture(livePage, 'live-desktop-attribution.png', false);
    await livePage.setViewportSize({ width: 390, height: 844 });
    await livePage.evaluate(() => window.scrollTo(0, 0));
    await capture(livePage, 'live-mobile.png', false);
    await livePage.getByTestId('lyrics-source').scrollIntoViewIfNeeded();
    await capture(livePage, 'live-mobile-attribution.png', false);
    clean(liveObserved);
    evidence.scenarios.push({ name: 'unintercepted-live-manual-provider-render-device-json', ok: true, localApiOrigin: live.url, providerStats: liveServerStats, result: liveResult, ...structuredClone(liveObserved) });

    // Require actual offline navigation; synthetic navigator flags or routed shells do not pass.
    await livePage.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 10000 });
    await livePage.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await liveContext.setOffline(true);
    await livePage.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
    await state(livePage, liveResult.state);
    await reading(livePage);
    assert.match(await livePage.getByTestId('lyrics-result').innerText(), /Cargada desde este dispositivo · sin conexión/);
    assert.equal(await livePage.evaluate(() => navigator.onLine), false);
    const offlineLyrics = await livePage.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}').entries?.[0]?.lyrics, storageKey);
    assert.ok(JSON.stringify(offlineLyrics) === JSON.stringify(liveStoredLyrics), 'Offline reload changed the saved result or its provenance');
    if (liveResult.state === 'plain') assert.ok(await livePage.getByTestId('plain-lyrics').textContent() === liveStoredLyrics.text, 'Offline reload did not render the saved plain content');
    else assert.ok(JSON.stringify(await livePage.locator('.lyrics__line').allTextContents()) === JSON.stringify(liveStoredLyrics.synced.map(line => line.words.join(' '))), 'Offline reload did not render the saved line content');
    await capture(livePage, 'offline-device-reload-mobile.png', false);
    clean(liveObserved);
    evidence.scenarios.push({ name: 'real-offline-reload-device-json', ok: true, navigatorOnline: false, sourceUrl: await livePage.getByTestId('lyrics-source').getAttribute('href'), ...structuredClone(liveObserved) });
    await liveContext.close();

    fixtures = await fixtureServer();
    const context = await browser.newContext({ viewport: { width: 1366, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce', acceptDownloads: true });
    const page = await context.newPage();
    const observed = observe(page, true);
    await page.goto(fixtures.url, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Busca tu canción', exact: true }).waitFor({ state: 'visible' });
    await search(page, 'Plain Fixture', 'Fixture Ensemble', 'Fixture Album'); await state(page, 'plain');
    await reading(page);
    await returnToSearch(page, true);
    assert.equal(await page.locator('#lyrics-title').inputValue(), 'Plain Fixture');
    assert.equal(await page.locator('#lyrics-artist').inputValue(), 'Fixture Ensemble');
    assert.equal(await page.locator('#lyrics-album').inputValue(), 'Fixture Album');
    assert.equal(fixtures.calls.length, 1, 'Returning to search unexpectedly repeated the lookup');
    await search(page, 'Plain Fixture', 'Fixture Ensemble', 'Fixture Album'); await state(page, 'plain');
    await reading(page);
    assert.match(await page.getByTestId('plain-lyrics').innerText(), /<img src=x/);
    assert.equal(await page.locator('[data-testid="plain-lyrics"] img').count(), 0);
    assert.equal(await page.evaluate(() => window.fixtureInjection), undefined);
    assert.match(await page.getByTestId('device-save-status').innerText(), /^Guardada en este dispositivo/);
    await capture(page, 'fixture-plain-desktop.png');
    const downloadEvent = page.waitForEvent('download');
    await sourceDetails(page);
    await page.getByRole('button', { name: 'Descargar letras JSON' }).click();
    const download = await downloadEvent;
    const stream = await download.createReadStream();
    const chunks = []; for await (const chunk of stream) chunks.push(chunk);
    const exported = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    assert.equal(exported.version, 1);
    assert.equal(exported.lyrics.sourceUrl, 'https://lrclib.net/api/get/101');
    assert.equal(exported.lyrics.requested.title, 'Plain Fixture');
    assert.equal(exported.lyrics.requested.album, 'Fixture Album');
    await search(page, 'Synced Fixture'); await state(page, 'synced');
    await reading(page);
    assert.match(await page.getByTestId('lyrics-result').innerText(), /Guía manual · Sin audio/);
    assert.equal(await page.getByTestId('lyrics-result').getByRole('progressbar').count(), 0, 'Manual line guide invented playback progress');
    assert.equal(await page.locator('.lyrics__line--active').innerText(), 'Original opening');
    await page.getByRole('button', { name: 'Siguiente línea', exact: true }).click();
    assert.equal(await page.locator('[aria-current="true"]').innerText(), 'Original ending');
    await page.getByRole('button', { name: 'Anterior', exact: true }).click();
    assert.equal(await page.locator('[aria-current="true"]').innerText(), 'Original opening');
    await page.setViewportSize({ width: 390, height: 844 }); await capture(page, 'fixture-synced-mobile.png');
    await search(page, 'Instrumental Fixture'); await state(page, 'instrumental');
    await reading(page);
    assert.equal(await page.getByTestId('plain-lyrics').count(), 0);
    await search(page, 'Missing Fixture'); await state(page, 'missing');
    assert.equal(await page.locator('form[aria-label="Buscar letras"]').isVisible(), true);
    assert.equal(await page.locator('#lyrics-title').inputValue(), 'Missing Fixture');
    assert.equal(await page.getByTestId('plain-lyrics').count(), 0);
    assert.ok(observed.requests.some(request => request.status === 404));
    await capture(page, 'fixture-missing-mobile.png');
    await search(page, 'Retry Fixture'); await state(page, 'error');
    assert.equal(await page.locator('form[aria-label="Buscar letras"]').isVisible(), true);
    assert.equal(await page.locator('#lyrics-title').inputValue(), 'Retry Fixture');
    const retry = page.getByRole('button', { name: 'Reintentar', exact: true });
    assert.equal(await retry.isDisabled(), true);
    const beforeRetry = fixtures.calls.filter(call => call.title === 'Retry Fixture').length;
    await page.getByRole('button', { name: 'Buscar letras', exact: true }).click();
    assert.equal(fixtures.calls.filter(call => call.title === 'Retry Fixture').length, beforeRetry, 'Manual resubmit bypassed cooldown');
    await capture(page, 'fixture-retry-cooldown-mobile.png');
    await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Reintentar')?.disabled, null, { timeout: 5000 });
    await retry.click(); await state(page, 'plain');
    assert.equal(fixtures.calls.filter(call => call.title === 'Retry Fixture').length, 2);
    assert.ok(observed.requests.some(request => request.status === 503));
    await search(page, 'Unavailable Fixture'); await state(page, 'error');
    await importDetails(page);
    await page.getByLabel('Importar letras JSON').setInputFiles({ name: 'fixture.lyrics.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
    await state(page, 'plain');
    await reading(page);
    assert.equal(await page.getByTestId('lyrics-source').getAttribute('href'), exported.lyrics.sourceUrl);
    const importedCache = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}'), storageKey);
    assert.deepEqual(importedCache.entries[0].lyrics, exported.lyrics);
    await capture(page, 'fixture-import-export-mobile.png');
    await importDetails(page);
    await page.getByLabel('Importar letras JSON').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{bad json') });
    await page.getByRole('alert').waitFor();
    assert.match(await page.getByRole('alert').innerText(), /archivo JSON de letras válido/);
    await page.getByLabel('Importar letras JSON').setInputFiles({ name: 'oversized.json', mimeType: 'application/json', buffer: Buffer.alloc(1024 * 1024 + 1, 0x20) });
    assert.match(await page.getByRole('alert').innerText(), /menos de 1 MB/);
    assert.equal(await page.getByTestId('plain-lyrics').textContent(), exported.lyrics.text, 'Invalid imports replaced the selected lyrics');
    clean(observed);
    evidence.scenarios.push({ name: 'keyboard-return-query-focus-safe-plain-manual-lines-instrumental-missing-retry503-cooldown-import-export-invalid-oversized-json', ok: true, exportFilename: download.suggestedFilename(), sourceUrl: exported.lyrics.sourceUrl, ...observed });
    await context.close();

    const playbackContext = await browser.newContext({ viewport: { width: 1366, height: 1000 }, serviceWorkers: 'block' });
    await playbackContext.addInitScript(() => {
      localStorage.setItem('spotify_token', 'fixture-access-initial');
      localStorage.setItem('spotify_refresh_token', 'fixture-refresh-initial');
      localStorage.setItem('token_expiry', String(Date.now() + 3600000));
    });
    const pollRequests = [];
    let tokenRequests = 0;
    let inFlight = 0;
    let maxInFlight = 0;
    await playbackContext.route('https://accounts.spotify.com/api/token', async route => {
      tokenRequests++;
      const parameters = new URLSearchParams(route.request().postData());
      assert.equal(parameters.get('grant_type'), 'refresh_token');
      assert.equal(parameters.get('refresh_token'), 'fixture-refresh-initial');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'fixture-access-refreshed', refresh_token: 'fixture-refresh-rotated', expires_in: 3600 }) });
    });
    await playbackContext.route('https://api.spotify.com/**', async route => {
      assert.equal(new URL(route.request().url()).pathname, '/v1/me/player/currently-playing');
      const index = pollRequests.length;
      pollRequests.push({ index, at: Date.now(), authorizationMatchesFixture: route.request().headers().authorization === `Bearer ${index === 0 ? 'fixture-access-initial' : 'fixture-access-refreshed'}` });
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        if (index === 0) { await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { status: 401, message: 'Synthetic expired access token' } }) }); return; }
        if (index === 2) { await route.fulfill({ status: 429, contentType: 'application/json', headers: { 'Retry-After': '1' }, body: JSON.stringify({ error: { status: 429, message: 'Synthetic rate limit' } }) }); return; }
        await new Promise(resolve => setTimeout(resolve, 180));
        const progress = index === 1 ? 8000 : index === 3 ? 2000 : 15000;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          item: { id: 'fixture-track', name: 'Synced Fixture', duration_ms: 10000, artists: [{ name: 'Fixture Ensemble' }], album: { name: '', images: [] } },
          progress_ms: progress, is_playing: false,
        }) });
      } finally { inFlight--; }
    });
    const playbackPage = await playbackContext.newPage();
    const playbackObserved = observe(playbackPage, true);
    await playbackPage.goto(fixtures.url, { waitUntil: 'domcontentloaded' });
    await state(playbackPage, 'synced');
    await playbackPage.waitForFunction(() => document.querySelector('.lyrics__line--active')?.textContent === 'Original ending');
    assert.equal(await playbackPage.getByRole('progressbar', { name: 'Progreso de la canción' }).getAttribute('aria-valuenow'), '8000');
    await playbackPage.waitForFunction(() => document.querySelector('.lyrics__line--active')?.textContent === 'Original opening', null, { timeout: 7000 });
    assert.equal(await playbackPage.getByRole('progressbar', { name: 'Progreso de la canción' }).getAttribute('aria-valuenow'), '2000');
    await playbackPage.waitForFunction(() => document.querySelector('[aria-label="Progreso de la canción"]')?.getAttribute('aria-valuenow') === '10000', null, { timeout: 5000 });
    assert.equal(await playbackPage.locator('.lyrics__line--active').innerText(), 'Original ending');
    await new Promise(resolve => setTimeout(resolve, 250));
    assert.equal(await playbackPage.getByRole('progressbar', { name: 'Progreso de la canción' }).getAttribute('aria-valuenow'), '10000', 'Paused progress advanced unexpectedly');
    assert.equal(tokenRequests, 1, '401 should refresh once and replay');
    assert.equal(maxInFlight, 1, 'Spotify polling overlapped');
    assert.ok(pollRequests.length >= 5);
    assert.ok(pollRequests.every(request => request.authorizationMatchesFixture));
    assert.ok(pollRequests[3].at - pollRequests[2].at >= 900, '429 cooldown did not delay the next poll');
    clean(playbackObserved); await capture(playbackPage, 'fixture-spotify-paused-seek-desktop.png');
    evidence.scenarios.push({ name: 'synthetic-spotify-401-refresh-replay-429-delay-no-overlap-paused-forward-backward-seek', ok: true, tokenRequests, maxInFlight, polls: pollRequests, realAccountOrPlaybackProof: false, ...playbackObserved });
    await playbackContext.close();

    for (const failure of ['quota', 'disabled', 'corrupt', 'eviction']) {
      const failureContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      const seed = Array.from({ length: 30 }, (_, index) => ({ savedAt: Date.now() - index, lyrics: fixtureLyrics({ title: `Stored Fixture ${index}`, artist: 'Fixture Ensemble' }) }));
      await failureContext.addInitScript(({ key, mode, entries }) => {
        if (mode === 'corrupt') localStorage.setItem(key, '{broken');
        if (mode === 'eviction') localStorage.setItem(key, JSON.stringify({ version: 1, entries }));
        if (mode === 'quota' || mode === 'disabled') {
          const originalSet = Storage.prototype.setItem;
          const originalGet = Storage.prototype.getItem;
          Storage.prototype.setItem = function setItem(name, value) {
            if (name === key) throw new DOMException('Fixture storage failure', mode === 'quota' ? 'QuotaExceededError' : 'SecurityError');
            return originalSet.call(this, name, value);
          };
          if (mode === 'disabled') Storage.prototype.getItem = function getItem(name) {
            if (name === key) throw new DOMException('Fixture storage disabled', 'SecurityError');
            return originalGet.call(this, name);
          };
        }
      }, { key: storageKey, mode: failure, entries: seed });
      const failurePage = await failureContext.newPage();
      const failureObserved = observe(failurePage);
      await failurePage.goto(fixtures.url, { waitUntil: 'domcontentloaded' });
      await failurePage.locator('#song-search').waitFor({ state: 'attached' });
      if (failure === 'corrupt') await state(failurePage, 'idle');
      await search(failurePage, 'Plain Fixture'); await state(failurePage, 'plain');
      const statusText = await failurePage.getByTestId('device-save-status').innerText();
      if (failure === 'quota' || failure === 'disabled') assert.match(statusText, /^No guardada en este dispositivo/);
      else {
        assert.match(statusText, /^Guardada en este dispositivo/);
        const cache = await failurePage.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}'), storageKey);
        if (failure === 'eviction') {
          assert.equal(cache.entries.length, 30);
          assert.equal(cache.entries[0].lyrics.requested.title, 'Plain Fixture');
          assert.equal(cache.entries.some(entry => entry.lyrics.requested.title === 'Stored Fixture 29'), false);
        }
      }
      await noOverflow(failurePage); clean(failureObserved);
      evidence.scenarios.push({ name: `device-storage-${failure}`, ok: true, deviceStatus: statusText, ...failureObserved });
      await failureContext.close();
    }
    evidence.ok = true;
  } catch (error) { evidence.error = error.message; evidence.stack = error.stack; }
  finally {
    await live?.close(); await fixtures?.close();
    if (browser) {
      evidence.browserCleanup = await closeBrowser(browser);
      if (!evidence.browserCleanup.terminated) { evidence.ok = false; evidence.cleanupError = 'Owned browser process did not terminate after bounded shutdown'; }
    }
    writeArtifact('e2e.json', evidence);
    console.log(JSON.stringify(evidence));
  }
  process.exit(evidence.ok ? 0 : 1);
})();
