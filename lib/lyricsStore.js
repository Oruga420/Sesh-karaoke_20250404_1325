const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { MAX_BYTES, isLyricsResult } = require('./lyricsContract');

function createJsonStore({ directory = path.join(__dirname, '..', '.cache', 'lyrics'), fs: fileSystem = fs,
  maxBytes = MAX_BYTES, now = Date.now } = {}) {
  const root = path.resolve(directory);
  const limit = Math.min(MAX_BYTES, Math.max(1, maxBytes));
  function fileFor(key) {
    if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key)) throw new TypeError('Invalid recording key');
    return path.join(root, key + '.json');
  }
  async function get(key) {
    try {
      const filename = fileFor(key);
      const stat = await fileSystem.stat(filename);
      if (!stat.isFile() || stat.size > limit) return null;
      const data = await fileSystem.readFile(filename, 'utf8');
      if (Buffer.byteLength(data) > limit) return null;
      const entry = JSON.parse(data);
      if (entry.schemaVersion !== 1 || entry.key !== key || !Number.isFinite(entry.expiresAt) ||
        entry.expiresAt <= now() || !isLyricsResult(entry.lyrics, key) ||
        !['found', 'instrumental'].includes(entry.lyrics.status)) return null;
      return entry.lyrics;
    } catch {
      return null;
    }
  }
  async function set(key, lyrics, { expiresAt = now() + 3600000 } = {}) {
    let temporary;
    try {
      const filename = fileFor(key);
      if (!isLyricsResult(lyrics, key) || !['found', 'instrumental'].includes(lyrics.status) ||
        !Number.isFinite(expiresAt) || expiresAt <= now()) return false;
      const content = JSON.stringify({ schemaVersion: 1, key, expiresAt, lyrics });
      if (Buffer.byteLength(content) > limit) return false;
      await fileSystem.mkdir(root, { recursive: true });
      temporary = filename + '.' + process.pid + '.' + randomUUID() + '.tmp';
      await fileSystem.writeFile(temporary, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      await fileSystem.rename(temporary, filename);
      return true;
    } catch {
      return false;
    } finally {
      if (temporary) await fileSystem.unlink(temporary).catch(() => {});
    }
  }
  return { get, set, directory: root };
}

module.exports = { createJsonStore };
