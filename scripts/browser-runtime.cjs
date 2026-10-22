const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const ownedServers = new WeakMap();
function argument(name) { return process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3); }
const optionsPath = path.resolve(argument('options') || path.join(__dirname, '..', 'artifacts', 'browser-options.json'));
const localOptions = fs.existsSync(optionsPath) ? JSON.parse(fs.readFileSync(optionsPath, 'utf8')) : {};
function existsProcess(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; }
}

async function bounded(operation, milliseconds) {
  let timer;
  try {
    return await Promise.race([
      operation().then(() => true, () => false),
      new Promise(resolve => { timer = setTimeout(() => resolve(false), milliseconds); }),
    ]);
  } finally { clearTimeout(timer); }
}
async function closeOwnedServer(server, browser) {
  const child = server.process();
  if (browser) await bounded(() => browser.close(), 4000);
  await bounded(() => server.close(), 4000);
  let forced = false;
  if (child.exitCode === null && child.signalCode === null) {
    forced = true;
    await bounded(() => server.kill(), 3000);
  }
  let directKillError;
  if (existsProcess(child.pid)) {
    // This handle belongs to the exact child created by launchServer in this call.
    // Never enumerate or terminate other Chrome/Edge processes.
    try { child.kill('SIGKILL'); } catch (error) { directKillError = error.code; }
    const deadline = Date.now() + 2000;
    while (existsProcess(child.pid) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
  }
  return { pid: child.pid, terminated: !existsProcess(child.pid), exitCode: child.exitCode, signal: child.signalCode, forced, osProcessAbsenceChecked: true, ...(directKillError ? { directKillError } : {}) };
}

function findRuntime() {
  const runtimeRoots = [process.env.CODEX_WORKSPACE_DEPENDENCIES, path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies')].filter(Boolean);
  for (const runtimeRoot of runtimeRoots) {
    for (const location of ['node/node_modules/playwright', 'node/node_modules/playwright-core']) {
      const modulePath = path.join(runtimeRoot, location);
      if (fs.existsSync(path.join(modulePath, 'package.json'))) return { modulePath, playwright: require(modulePath) };
    }
  }
  for (const name of ['playwright', 'playwright-core']) {
    try { return { modulePath: require.resolve(name), playwright: require(name) }; } catch { /* try only installed runtimes */ }
  }
  throw new Error('Existing Playwright runtime unavailable. No browser or package was downloaded.');
}
function browserCandidates() {
  const selected = argument('browser-path') || process.env.KARAOKE_BROWSER_PATH || localOptions.browserPath;
  if (selected) {
    const configured = path.resolve(selected);
    return fs.existsSync(configured) ? [configured] : [];
  }
  const candidates = [process.env.KARAOKE_BROWSER_PATH,
    path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe')];
  const cache = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData/Local'), 'ms-playwright');
  if (fs.existsSync(cache)) for (const entry of fs.readdirSync(cache).filter(name => /^chromium-\d+$/.test(name)).sort().reverse()) {
    candidates.push(path.join(cache, entry, 'chrome-win64/chrome.exe'), path.join(cache, entry, 'chrome-win/chrome.exe'));
  }
  return [...new Set(candidates.filter(filename => filename && fs.existsSync(filename)))];
}
async function launchBrowser(preferred) {
  const runtime = findRuntime();
  const failures = [];
  const candidates = preferred ? [preferred] : browserCandidates();
  const launchTimeoutMs = Math.min(30000, Math.max(1000, Number(argument('launch-timeout-ms') || process.env.KARAOKE_BROWSER_LAUNCH_TIMEOUT_MS || localOptions.launchTimeoutMs) || 12000));
  for (const executablePath of candidates) {
    let server;
    try {
      server = await runtime.playwright.chromium.launchServer({ executablePath, headless: true, host: '127.0.0.1', timeout: launchTimeoutMs, args: ['--no-first-run', '--no-default-browser-check', '--disable-extensions'] });
      const browser = await runtime.playwright.chromium.connect(server.wsEndpoint(), { timeout: launchTimeoutMs });
      ownedServers.set(browser, server);
      return { ...runtime, browser, executablePath, browserPid: server.process().pid, launchTimeoutMs };
    } catch (error) {
      if (server) await closeOwnedServer(server);
      failures.push({ executablePath, error: error.message.split('\n')[0] });
    }
  }
  throw new Error(`Existing browsers failed to launch; no downloads attempted. ${JSON.stringify(failures)}`);
}
async function closeBrowser(browser) {
  const server = ownedServers.get(browser);
  if (!server) return { terminated: await bounded(() => browser.close(), 4000), pid: null, ownership: 'no owned browser server' };
  const result = await closeOwnedServer(server, browser);
  ownedServers.delete(browser);
  return result;
}
module.exports = { findRuntime, browserCandidates, launchBrowser, closeBrowser };
