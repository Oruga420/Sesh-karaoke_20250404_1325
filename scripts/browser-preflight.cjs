const { launchBrowser, closeBrowser, browserCandidates } = require('./browser-runtime.cjs');
const { writeArtifact } = require('./harness.cjs');

(async () => {
  let result = { ok: false, noDownloads: true, attempts: [] };
  for (const candidate of browserCandidates()) {
    let browser;
    try {
      const runtime = await launchBrowser(candidate);
      browser = runtime.browser;
      const page = await browser.newPage();
      await page.goto('data:text/html,<title>Existing browser preflight</title><h1>Ready</h1>', { timeout: 10000, waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Ready' }).waitFor({ timeout: 5000 });
      if (await page.title() !== 'Existing browser preflight') throw new Error('Existing browser did not render the local fixture');
      result = { ...result, ok: true, runtimePath: runtime.modulePath, executablePath: runtime.executablePath, browserPid: runtime.browserPid, launchTimeoutMs: runtime.launchTimeoutMs, browserVersion: browser.version(), rendered: true, measuredAt: new Date().toISOString() };
      break;
    } catch (error) {
      result.attempts.push({ executablePath: candidate, error: error.message.split('\n')[0] });
    } finally {
      if (browser) {
        result.browserCleanup = await closeBrowser(browser);
        if (!result.browserCleanup.terminated) { result.ok = false; result.error = 'Owned browser process did not terminate after bounded shutdown'; }
      }
    }
  }
  if (!result.ok && !result.error) result.error = result.rendered ? 'The fixture rendered, but owned browser cleanup was not verified.' : 'No existing browser completed launch and local fixture rendering. Inspect attempts; no dependencies or browsers were downloaded.';
  writeArtifact('browser-preflight.json', result);
  console.log(JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
})();
