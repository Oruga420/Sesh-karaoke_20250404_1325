export interface Recording {
  title: string;
  artist: string;
  album: string;
  duration: number;
  trackId?: string;
}

export interface SyncedLine { time: number; words: string[] }

export interface LyricsResult {
  status: 'found' | 'instrumental' | 'not_found' | 'unavailable';
  timing: 'line' | 'none';
  text: string;
  synced: SyncedLine[];
  source: string | null;
  sourceUrl: string | null;
  songInfo: Recording | null;
  requested: Recording;
  confidence: 'exact' | 'matched' | 'title-artist' | 'none';
  fetchedAt: string;
  cache: { hit: boolean; storage: 'memory' | 'disk' | 'none'; persisted: boolean };
  retryAfter?: number;
}

export interface LyricsLookup { lyrics: LyricsResult; savedOnDevice: boolean; fromDevice: boolean; imported?: boolean }

export const DEVICE_CACHE_KEY = 'oruga-karaoke.lyrics.v1';
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const CACHE_MAX_ENTRIES = 30;
export const MAX_JSON_BYTES = 1024 * 1024;
const MAX_TEXT_LENGTH = 120000;
interface CacheEntry { savedAt: number; lyrics: LyricsResult; imported?: boolean }
interface DeviceCache { version: 1; entries: CacheEntry[] }

export class LyricsRequestError extends Error {
  constructor(message: string, public status = 0, public offline = false, public retryAfter = 0) {
    super(message);
    this.name = 'LyricsRequestError';
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function shortString(value: unknown, limit = 1000): value is string {
  return typeof value === 'string' && value.length <= limit;
}
function hasControlCharacters(value: string): boolean {
  return Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}
function recording(value: unknown): value is Recording {
  return object(value) && shortString(value.title) && value.title.trim().length > 0 &&
    shortString(value.artist) && value.artist.trim().length > 0 && shortString(value.album) &&
    [value.title, value.artist, value.album].every(field => field.length <= 500 && !hasControlCharacters(field)) &&
    normalize(value.title).length > 0 && normalize(value.artist).length > 0 &&
    typeof value.duration === 'number' && Number.isFinite(value.duration) && value.duration >= 0 &&
    value.duration <= 3600000 && (value.trackId === undefined || (shortString(value.trackId, 200) && !hasControlCharacters(value.trackId)));
}

function normalize(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(new RegExp('[^\\p{L}\\p{N}]+', 'gu'), ' ').trim().replace(/\s+/g, ' ');
}
function versionSensitive(value: Recording): boolean {
  return /\b(live|remix|remaster\w*|acoustic|unplugged|edit|version|instrumental|karaoke|demo|mono|stereo|mix|session|sped|slowed|reverb|rerecord\w*)\b|\ben vivo\b/i
    .test(normalize(value.title + ' ' + value.album));
}

export function safeSourceUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port ? url.href : null;
  } catch { return null; }
}

export function validateLyrics(value: unknown): LyricsResult | null {
  if (!object(value) || !['found', 'instrumental', 'not_found', 'unavailable'].includes(String(value.status)) ||
    !['line', 'none'].includes(String(value.timing)) || !shortString(value.text, MAX_TEXT_LENGTH) ||
    !Array.isArray(value.synced) || value.synced.length > 4000 || !recording(value.requested) ||
    !(value.songInfo === null || recording(value.songInfo)) ||
    !(value.source === null || shortString(value.source, 200)) ||
    !(value.sourceUrl === null || shortString(value.sourceUrl, 4000)) ||
    !['exact', 'matched', 'title-artist', 'none'].includes(String(value.confidence)) ||
    !shortString(value.fetchedAt, 64) || !Number.isFinite(Date.parse(value.fetchedAt)) ||
    !object(value.cache) || typeof value.cache.hit !== 'boolean' || typeof value.cache.persisted !== 'boolean' ||
    !['memory', 'disk', 'none'].includes(String(value.cache.storage))) return null;
  let previous = -1;
  for (const line of value.synced) {
    if (!object(line) || typeof line.time !== 'number' || !Number.isFinite(line.time) || line.time < 0 ||
      line.time < previous || line.time > 24 * 60 * 60 || !Array.isArray(line.words) ||
      line.words.length === 0 || line.words.length > 1000 || !line.words.every(word => shortString(word, 2000) && word.trim())) return null;
    previous = line.time;
  }
  if (value.retryAfter !== undefined && (typeof value.retryAfter !== 'number' ||
    !Number.isFinite(value.retryAfter) || value.retryAfter < 0 || value.retryAfter > 86400)) return null;
  if (value.timing === 'none' && value.synced.length !== 0) return null;
  if (value.status === 'found') {
    if (!value.songInfo || !value.source || value.confidence === 'none' ||
      (!value.text.trim() && value.synced.length === 0) ||
      (value.timing === 'line' && value.synced.length === 0)) return null;
  } else if (value.text !== '' || value.synced.length !== 0 || value.timing !== 'none') return null;
  if ((value.status === 'not_found' || value.status === 'unavailable') &&
    (value.songInfo !== null || value.source !== null || value.sourceUrl !== null || value.confidence !== 'none')) return null;
  if (value.status === 'found' || value.status === 'instrumental') {
    const info = value.songInfo;
    const requested = value.requested;
    const sourceUrl = safeSourceUrl(value.sourceUrl as string | null);
    if (!info || !sourceUrl || normalize(info.title) !== normalize(requested.title) ||
      normalize(info.artist) !== normalize(requested.artist)) return null;
    const host = new URL(sourceUrl).hostname;
    if (value.source === 'lrclib.net') {
      if (host !== 'lrclib.net' || !['exact', 'matched'].includes(String(value.confidence)) ||
        (versionSensitive(info) && !versionSensitive(requested)) ||
        (requested.album && normalize(info.album) !== normalize(requested.album)) ||
        (requested.duration && (info.duration <= 0 || Math.abs(info.duration - requested.duration) > 2000))) return null;
    } else if (value.source !== 'lyrics.ovh' || host !== 'api.lyrics.ovh' || value.confidence !== 'title-artist' ||
      value.timing !== 'none' || value.status !== 'found' || versionSensitive(requested)) return null;
  }
  if (byteLength(JSON.stringify(value)) > 512 * 1024) return null;
  const typed = value as unknown as LyricsResult;
  const copyRecording = (item: Recording): Recording => ({ title: item.title, artist: item.artist,
    album: item.album, duration: item.duration, ...(item.trackId ? { trackId: item.trackId } : {}) });
  return {
    status: typed.status, timing: typed.timing, text: typed.text,
    synced: typed.synced.map(line => ({ time: line.time, words: [...line.words] })),
    source: typed.source, sourceUrl: safeSourceUrl(typed.sourceUrl),
    requested: copyRecording(typed.requested), songInfo: typed.songInfo ? copyRecording(typed.songInfo) : null,
    confidence: typed.confidence, fetchedAt: typed.fetchedAt,
    cache: { hit: typed.cache.hit, storage: typed.cache.storage, persisted: typed.cache.persisted },
    ...(typed.retryAfter !== undefined ? { retryAfter: typed.retryAfter } : {}),
  };
}

export function recordingKey(value: Recording): string {
  return JSON.stringify([normalize(value.title), normalize(value.artist), normalize(value.album), value.duration, value.trackId || '']);
}
function byteLength(value: string): number { return new Blob([value]).size; }
function removeCorruptCache(): void {
  try { localStorage.removeItem(DEVICE_CACHE_KEY); } catch { /* Storage may be disabled. */ }
}
function readCache(now = Date.now()): DeviceCache {
  try {
    const raw = localStorage.getItem(DEVICE_CACHE_KEY);
    if (!raw) return { version: 1, entries: [] };
    if (byteLength(raw) > MAX_JSON_BYTES) throw new Error('Cache too large');
    const parsed: unknown = JSON.parse(raw);
    if (!object(parsed) || parsed.version !== 1 || !Array.isArray(parsed.entries) ||
      parsed.entries.length > CACHE_MAX_ENTRIES) throw new Error('Invalid cache');
    const keys = new Set<string>();
    const entries: CacheEntry[] = [];
    for (const entry of parsed.entries) {
      if (!object(entry) || typeof entry.savedAt !== 'number' || !Number.isFinite(entry.savedAt)) continue;
      const lyrics = validateLyrics(entry.lyrics);
      if (!lyrics || !['found', 'instrumental'].includes(lyrics.status) || entry.savedAt > now + 60000 ||
        now - entry.savedAt > CACHE_TTL_MS || Date.parse(lyrics.fetchedAt) > now + 60000 ||
        now - Date.parse(lyrics.fetchedAt) > CACHE_TTL_MS) continue;
      const key = recordingKey(lyrics.requested);
      if (!keys.has(key)) { entries.push({ savedAt: entry.savedAt, lyrics, imported: entry.imported === true }); keys.add(key); }
    }
    return { version: 1, entries: entries.sort((a, b) => b.savedAt - a.savedAt) };
  } catch { removeCorruptCache(); return { version: 1, entries: [] }; }
}

export function getSavedLyrics(requested: Recording): LyricsLookup | null {
  const entry = readCache().entries.find(item => recordingKey(item.lyrics.requested) === recordingKey(requested));
  return entry ? { lyrics: entry.lyrics, savedOnDevice: true, fromDevice: true, imported: entry.imported } : null;
}
export function getLastSavedLyrics(): LyricsLookup | null {
  const entry = readCache().entries[0];
  return entry ? { lyrics: entry.lyrics, savedOnDevice: true, fromDevice: true, imported: entry.imported } : null;
}
export function saveLyricsOnDevice(result: LyricsResult, imported = false): boolean {
  const lyrics = validateLyrics(result);
  if (!lyrics || !['found', 'instrumental'].includes(lyrics.status) ||
    Date.now() - Date.parse(lyrics.fetchedAt) > CACHE_TTL_MS || Date.parse(lyrics.fetchedAt) > Date.now() + 60000) return false;
  const entries = readCache().entries.filter(entry => recordingKey(entry.lyrics.requested) !== recordingKey(lyrics.requested));
  entries.unshift({ savedAt: Date.now(), lyrics, imported });
  entries.splice(CACHE_MAX_ENTRIES);
  try {
    let json = JSON.stringify({ version: 1, entries });
    while (byteLength(json) > MAX_JSON_BYTES && entries.length > 1) {
      entries.pop(); json = JSON.stringify({ version: 1, entries });
    }
    if (byteLength(json) > MAX_JSON_BYTES) return false;
    localStorage.setItem(DEVICE_CACHE_KEY, json);
    return getSavedLyrics(lyrics.requested) !== null;
  } catch { return false; }
}

export function exportLyricsJson(result: LyricsResult): string {
  const lyrics = validateLyrics(result);
  if (!lyrics || !['found', 'instrumental'].includes(lyrics.status)) throw new Error('Only retrieved lyrics can be exported.');
  const json = JSON.stringify({ version: 1, lyrics }, null, 2);
  if (byteLength(json) > MAX_JSON_BYTES) throw new Error('Lyrics JSON is too large.');
  return json;
}
export function importLyricsJson(json: string): LyricsLookup {
  if (byteLength(json) > MAX_JSON_BYTES) throw new Error('Lyrics JSON must be smaller than 1 MB.');
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { throw new Error('Choose a valid lyrics JSON file.'); }
  const lyrics = object(parsed) && parsed.version === 1 ? validateLyrics(parsed.lyrics) : null;
  if (!lyrics || !['found', 'instrumental'].includes(lyrics.status)) throw new Error('Unsupported or invalid lyrics JSON.');
  return { lyrics, savedOnDevice: saveLyricsOnDevice(lyrics, true), fromDevice: false, imported: true };
}

interface LookupOptions { signal?: AbortSignal; bypassCache?: boolean }
export async function fetchLyrics(requested: Recording, options: LookupOptions = {}): Promise<LyricsLookup> {
  if (!recording(requested)) throw new LyricsRequestError('Enter a song title and artist.');
  if (options.signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
  const cached = getSavedLyrics(requested);
  const offline = navigator.onLine === false;
  if (cached && (!options.bypassCache || offline)) return cached;
  if (offline) throw new LyricsRequestError('You are offline. No saved lyrics for this recording.', 0, true);
  const params = new URLSearchParams({ title: requested.title, artist: requested.artist });
  if (requested.album) params.set('album', requested.album);
  if (requested.duration) params.set('duration', String(requested.duration));
  if (requested.trackId) params.set('trackId', requested.trackId);
  const base = (process.env.REACT_APP_API_URL || '').replace(/\/$/, '');
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 10000);
  try {
    const response = await fetch(`${base}/api/lyrics?${params}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
    const raw = await response.text();
    if (options.signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    if (byteLength(raw) > MAX_JSON_BYTES) throw new LyricsRequestError('Lyrics response is too large.', response.status);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { throw new LyricsRequestError('The lyrics service returned an invalid response.', response.status); }
    const lyrics = object(body) ? validateLyrics(body.lyrics) : null;
    const expectedStatus = lyrics?.status === 'not_found' ? 404 : lyrics?.status === 'unavailable' ? 503 : 200;
    if (!lyrics || response.status !== expectedStatus || recordingKey(lyrics.requested) !== recordingKey(requested)) {
      const headerDelay = Number(response.headers.get('Retry-After'));
      throw new LyricsRequestError('The lyrics service could not complete this lookup.', response.status, false,
        Number.isFinite(headerDelay) ? Math.max(0, Math.min(86400, headerDelay)) : 0);
    }
    const headerDelay = Number(response.headers.get('Retry-After'));
    if (Number.isFinite(headerDelay) && headerDelay > 0) lyrics.retryAfter = Math.min(86400, headerDelay);
    return { lyrics, savedOnDevice: saveLyricsOnDevice(lyrics), fromDevice: false };
  } catch (error) {
    if (options.signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    if (error instanceof LyricsRequestError) throw error;
    if (cached) return cached;
    if (timedOut) throw new LyricsRequestError('The lyrics lookup timed out. Please retry.');
    throw new LyricsRequestError('Could not connect to the lyrics service. Check your connection and retry.', 0, navigator.onLine === false);
  } finally { clearTimeout(timeout); options.signal?.removeEventListener('abort', abort); }
}
