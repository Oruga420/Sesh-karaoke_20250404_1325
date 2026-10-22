const axios = require('axios');
const { parseLrc } = require('./lrcParser');
const { MAX_BYTES, normalize, validateQuery, recordingKey, isLyricsResult, versionSensitive } = require('./lyricsContract');

const LRCLIB = 'https://lrclib.net/api';
const OVH = 'https://api.lyrics.ovh/v1';
const USER_AGENT = 'Oruga Karaoke 1.0 (https://github.com/Oruga420/Sesh-karaoke_20250404_1325)';

function matches(record, request) {
  if (!record || typeof record !== 'object' || Array.isArray(record) ||
    typeof record.trackName !== 'string' || typeof record.artistName !== 'string') return false;
  if (normalize(record.trackName) !== normalize(request.title) ||
    normalize(record.artistName) !== normalize(request.artist)) return false;
  if (versionSensitive({ title: record.trackName, album: record.albumName || '' }) && !versionSensitive(request)) return false;
  if (request.album && (typeof record.albumName !== 'string' || normalize(record.albumName) !== normalize(request.album))) return false;
  if (request.duration && (typeof record.duration !== 'number' || !Number.isFinite(record.duration) ||
    Math.abs(record.duration * 1000 - request.duration) > 2000)) return false;
  return true;
}

function makeResult(request, now, status = 'not_found') {
  return { status, timing: 'none', text: '', synced: [], source: null, sourceUrl: null, songInfo: null,
    requested: { ...request }, confidence: 'none', fetchedAt: new Date(now()).toISOString(),
    cache: { hit: false, storage: 'none', persisted: false } };
}

function fromRecord(record, request, confidence, now) {
  if (!matches(record, request)) return null;
  const instrumental = record.instrumental === true;
  const synced = instrumental ? [] : parseLrc(record.syncedLyrics);
  const text = instrumental ? '' : typeof record.plainLyrics === 'string' && record.plainLyrics.trim() ?
    record.plainLyrics : synced.map((line) => line.words.join(' ')).join('\n');
  if (!instrumental && !text.trim() && synced.length === 0) return null;
  const result = { ...makeResult(request, now), status: instrumental ? 'instrumental' : 'found',
    timing: synced.length ? 'line' : 'none', text, synced, source: 'lrclib.net',
    sourceUrl: Number.isSafeInteger(record.id) && record.id > 0 ? LRCLIB + '/get/' + record.id : 'https://lrclib.net',
    songInfo: { title: record.trackName, artist: record.artistName,
      album: typeof record.albumName === 'string' ? record.albumName : '',
      duration: typeof record.duration === 'number' && Number.isFinite(record.duration) && record.duration > 0 ? record.duration * 1000 : 0 },
    confidence };
  return isLyricsResult(result) ? result : null;
}

function selectRecord(records, request, now) {
  const matching = records.map((record) => fromRecord(record, request, 'matched', now)).filter(Boolean);
  // If the caller omitted the disambiguating fields, different releases/lengths
  // remain ambiguous even when one of them happens to contain synchronized text.
  const signatures = new Set(matching.map((result) => JSON.stringify([
    request.album ? '' : normalize(result.songInfo.album),
    request.duration ? 0 : Math.round(result.songInfo.duration / 2000),
  ])));
  if (signatures.size > 1) return null;
  matching.sort((left, right) => {
    const durationDifference = Math.abs(left.songInfo.duration - request.duration) - Math.abs(right.songInfo.duration - request.duration);
    return (request.duration ? durationDifference : 0) || right.synced.length - left.synced.length;
  });
  return matching[0] || null;
}

function retrySeconds(headers, now, fallback = 1) {
  const value = headers && (headers['retry-after'] || headers['Retry-After']);
  if (typeof value === 'string' || typeof value === 'number') {
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.max(1, Math.ceil(seconds));
    const date = Date.parse(value);
    if (Number.isFinite(date)) return Math.max(1, Math.ceil((date - now()) / 1000));
  }
  return fallback;
}

function createResolver({ httpClient = axios, store = null, deadlineMs = 7800, stageTimeoutMs = 1800,
  requestDelayMs = 200, ttlMs = 3600000, negativeTtlMs = 30000, maxEntries = 200, maxInflight = 64,
  now = Date.now } = {}) {
  const memory = new Map();
  const inflight = new Map();
  const cooldown = new Map();
  const totalBudget = Math.min(8000, Math.max(1, deadlineMs));
  const capacity = Math.max(1, Math.min(1000, Math.floor(maxEntries)));
  const copy = (value) => JSON.parse(JSON.stringify(value));
  function prune() {
    for (const [key, entry] of memory) if (entry.expiresAt <= now()) memory.delete(key);
  }
  function remember(key, lyrics, lifetime) {
    prune();
    memory.delete(key);
    memory.set(key, { lyrics: copy(lyrics), expiresAt: now() + lifetime });
    while (memory.size > capacity) memory.delete(memory.keys().next().value);
  }

  async function lookup(request, key) {
    const expires = Date.now() + totalBudget;
    let transient = false;
    let retryAfter = 0;
    let lastLrcRequest = 0;
    const remaining = () => Math.max(0, expires - Date.now());
    async function bounded(task, milliseconds) {
      let timer;
      try {
        return await Promise.race([Promise.resolve().then(task), new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Lyrics deadline exceeded')), milliseconds);
        })]);
      } finally { clearTimeout(timer); }
    }
    if (store && remaining() > 0) {
      try {
        const disk = await bounded(() => store.get(key), Math.min(250, remaining()));
        if (isLyricsResult(disk, key) && ['found', 'instrumental'].includes(disk.status)) {
          const result = { ...disk, requested: { ...request }, cache: { hit: true, storage: 'disk', persisted: true } };
          const age = Math.max(0, now() - Date.parse(disk.fetchedAt));
          remember(key, result, Math.max(1, Math.min(ttlMs, ttlMs - age)));
          return result;
        }
      } catch { /* A failed local store does not disable public lookup. */ }
    }

    async function fetchProvider(url) {
      const provider = new URL(url).hostname;
      const cooldownUntil = cooldown.get(provider) || 0;
      if (cooldownUntil > now()) {
        transient = true;
        retryAfter = Math.max(retryAfter, Math.ceil((cooldownUntil - now()) / 1000));
        return null;
      }
      if (provider === 'lrclib.net' && lastLrcRequest) {
        const delay = Math.max(0, requestDelayMs - (Date.now() - lastLrcRequest));
        if (delay > 0 && remaining() > delay) await new Promise((resolve) => setTimeout(resolve, delay));
      }
      if (remaining() <= 0) { transient = true; return null; }
      const timeout = Math.max(1, Math.min(stageTimeoutMs, remaining()));
      const controller = new AbortController();
      try {
        const response = await bounded(() => httpClient.get(url, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
          timeout, signal: controller.signal, maxRedirects: 0, maxContentLength: MAX_BYTES,
          maxBodyLength: MAX_BYTES, responseType: 'json', validateStatus: () => true,
          transitional: { silentJSONParsing: false },
        }), timeout);
        if (!response || !Number.isInteger(response.status)) throw new Error('Invalid provider response');
        if (response.status === 429 || response.status === 503) {
          const seconds = retrySeconds(response.headers, now);
          cooldown.set(provider, now() + seconds * 1000);
          retryAfter = Math.max(retryAfter, seconds);
          transient = true;
          return null;
        }
        if (response.status === 404) return { missing: true };
        if (response.status !== 200 || !response.data || typeof response.data !== 'object' ||
          Buffer.byteLength(JSON.stringify(response.data)) > MAX_BYTES) throw new Error('Invalid provider body');
        return { data: response.data };
      } catch {
        transient = true;
        return null;
      } finally {
        controller.abort();
        if (provider === 'lrclib.net') lastLrcRequest = Date.now();
      }
    }

    const params = new URLSearchParams({ track_name: request.title, artist_name: request.artist });
    if (request.album) params.set('album_name', request.album);
    const exactParams = new URLSearchParams(params);
    if (request.duration) exactParams.set('duration', String(request.duration / 1000));
    const exact = await fetchProvider(LRCLIB + '/get?' + exactParams);
    let result = exact && exact.data && !Array.isArray(exact.data) ? fromRecord(exact.data, request, 'exact', now) : null;
    if (exact && exact.data && (Array.isArray(exact.data) || typeof exact.data.trackName !== 'string' || typeof exact.data.artistName !== 'string')) transient = true;
    for (const searchParams of [params, new URLSearchParams({ q: request.title + ' ' + request.artist })]) {
      if (result) break;
      const search = await fetchProvider(LRCLIB + '/search?' + searchParams);
      if (search && search.data) {
        if (Array.isArray(search.data)) result = selectRecord(search.data.slice(0, 100), request, now);
        else transient = true;
      }
    }
    if (!result && !versionSensitive(request)) {
      const sourceUrl = OVH + '/' + encodeURIComponent(request.artist) + '/' + encodeURIComponent(request.title);
      const fallback = await fetchProvider(sourceUrl);
      if (fallback && fallback.data) {
        if (typeof fallback.data.lyrics === 'string' && fallback.data.lyrics.trim()) {
          result = { ...makeResult(request, now, 'found'), text: fallback.data.lyrics,
            source: 'lyrics.ovh', sourceUrl, confidence: 'title-artist',
            songInfo: { title: request.title, artist: request.artist, album: '', duration: 0 } };
        } else if (typeof fallback.data.lyrics !== 'string') transient = true;
      }
    }
    if (!result) {
      result = makeResult(request, now, transient ? 'unavailable' : 'not_found');
      if (retryAfter) result.retryAfter = retryAfter;
      if (!transient) {
        result.cache = { hit: false, storage: 'memory', persisted: false };
        remember(key, result, negativeTtlMs);
      }
      return result;
    }
    result.cache = { hit: false, storage: 'memory', persisted: false };
    if (store && remaining() > 0) {
      try {
        const persisted = await bounded(() => store.set(key, result, { expiresAt: now() + ttlMs }), Math.min(300, remaining()));
        if (persisted === true) result.cache = { hit: false, storage: 'disk', persisted: true };
      } catch { /* Memory reuse still works when the local directory is unavailable. */ }
    }
    remember(key, result, ttlMs);
    return result;
  }

  async function resolveLyrics(query) {
    const request = validateQuery(query);
    const key = recordingKey(request);
    prune();
    const cached = memory.get(key);
    if (cached) {
      memory.delete(key);
      memory.set(key, cached);
      return { ...copy(cached.lyrics), requested: request,
        cache: { hit: true, storage: 'memory', persisted: cached.lyrics.cache.persisted } };
    }
    if (!inflight.has(key)) {
      if (inflight.size >= maxInflight) return { ...makeResult(request, now, 'unavailable'), retryAfter: 1 };
      const operation = lookup(request, key).finally(() => inflight.delete(key));
      inflight.set(key, operation);
    }
    return { ...copy(await inflight.get(key)), requested: request };
  }
  return { resolveLyrics, clearMemory() { memory.clear(); }, cacheSize() { prune(); return memory.size; } };
}

const sharedResolver = createResolver();
module.exports = { createResolver, resolveLyrics: sharedResolver.resolveLyrics, recordingKey, validateQuery, versionSensitive };
