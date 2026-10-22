const fs = require('node:fs');
const path = require('node:path');
const { fork } = require('node:child_process');

const root = path.join(__dirname, '..');
function writeArtifact(name, value) {
  const filename = path.join(root, 'artifacts', name);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`);
  return filename;
}
async function startServer({ directory, offline = false, serveFrontend = false } = {}) {
  const child = fork(path.join(__dirname, 'server-child.cjs'), [], {
    cwd: root,
    env: { ...process.env, LYRICS_TEST_DIRECTORY: directory || '', LYRICS_TEST_OFFLINE: offline ? '1' : '', LYRICS_TEST_FRONTEND: serveFrontend ? '1' : '' },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    windowsHide: true,
  });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  child.stdout.on('data', () => {});
  const ready = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Local server did not start within 15s: ${stderr.slice(0, 1000)}`)); }, 15000);
    child.once('message', message => { clearTimeout(timer); message.error ? reject(new Error(message.error)) : resolve(message); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Local server exited ${code}: ${stderr.slice(0, 1000)}`)); });
  });
  return {
    ...ready,
    child,
    async stats() {
      const id = `${Date.now()}-${Math.random()}`;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { child.off('message', receive); reject(new Error('Server statistics IPC timed out')); }, 2000);
        function receive(message) {
          if (message.id !== id) return;
          clearTimeout(timer); child.off('message', receive); resolve(message);
        }
        child.on('message', receive);
        child.send({ stats: true, id });
      });
    },
    async close() {
      if (child.connected) child.send({ close: true });
      await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 1500))]);
      if (child.exitCode === null) child.kill();
    },
  };
}
function summary(result) {
  return {
    status: result.status, timing: result.timing, source: result.source, sourceUrl: result.sourceUrl,
    confidence: result.confidence, songInfo: result.songInfo, requested: result.requested,
    fetchedAt: result.fetchedAt, cache: result.cache,
    textCharacters: result.text?.length || 0, syncedLines: result.synced?.length || 0,
  };
}
module.exports = { root, writeArtifact, startServer, summary };
