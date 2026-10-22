const { createHash } = require('node:crypto');

const MAX_BYTES = 512 * 1024;
const STATUSES = new Set(['found', 'instrumental', 'not_found', 'unavailable']);
const CONFIDENCES = new Set(['exact', 'matched', 'title-artist', 'none']);

function normalize(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

function versionSensitive(request) {
  return /\b(live|remix|remaster\w*|acoustic|unplugged|edit|version|instrumental|karaoke|demo|mono|stereo|mix|session|sped|slowed|reverb|rerecord\w*)\b|\ben vivo\b/i
    .test(normalize(request.title + ' ' + request.album));
}

function validateQuery(query) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) throw new TypeError('Invalid query');
  const result = {};
  for (const field of ['title', 'artist', 'album', 'trackId']) {
    const value = query[field];
    const optional = field === 'album' || field === 'trackId';
    if (value == null && optional) {
      if (field === 'album') result.album = '';
      continue;
    }
    if (typeof value !== 'string' || value.length > (field === 'trackId' ? 200 : 500) ||
      Array.from(value).some((character) => {
        const code = character.charCodeAt(0);
        return code <= 31 || code === 127;
      })) {
      throw new TypeError('Invalid ' + field + ' query');
    }
    const trimmed = value.trim();
    if (!optional && (!trimmed || !normalize(trimmed))) throw new TypeError('Missing ' + field + ' query');
    if (field !== 'trackId' || trimmed) result[field] = trimmed;
  }
  const rawDuration = query.duration;
  if (rawDuration == null || rawDuration === '') result.duration = 0;
  else {
    if (!['string', 'number'].includes(typeof rawDuration)) throw new TypeError('Invalid duration query');
    const duration = Number(rawDuration);
    if (!Number.isFinite(duration) || duration < 0 || duration > 3600000 ||
      (typeof rawDuration === 'string' && !/^\d+(?:\.\d+)?$/.test(rawDuration))) {
      throw new TypeError('Invalid duration query');
    }
    result.duration = duration;
  }
  return result;
}

function recordingKey(query) {
  const request = validateQuery(query);
  return createHash('sha256').update(JSON.stringify([
    normalize(request.title), normalize(request.artist), normalize(request.album), request.duration, request.trackId || '',
  ])).digest('hex');
}

function validSongInfo(info) {
  return !!info && typeof info === 'object' && ['title', 'artist', 'album'].every((field) =>
    typeof info[field] === 'string' && info[field].length <= 500) && Number.isFinite(info.duration) &&
    info.duration >= 0 && info.duration <= 3600000;
}

function isLyricsResult(value, key) {
  try {
    if (!value || !STATUSES.has(value.status) || !CONFIDENCES.has(value.confidence) ||
      !['line', 'none'].includes(value.timing) || typeof value.text !== 'string' ||
      !Array.isArray(value.synced) || value.synced.length > 10000 ||
      !value.cache || typeof value.cache.hit !== 'boolean' || typeof value.cache.persisted !== 'boolean' ||
      !['memory', 'disk', 'none'].includes(value.cache.storage) ||
      typeof value.fetchedAt !== 'string' || !Number.isFinite(Date.parse(value.fetchedAt)) ||
      (value.retryAfter != null && (!Number.isFinite(value.retryAfter) || value.retryAfter < 0)) ||
      Buffer.byteLength(JSON.stringify(value)) > MAX_BYTES) return false;
    if (!value.requested || ['title', 'artist', 'album'].some((field) => typeof value.requested[field] !== 'string') ||
      typeof value.requested.duration !== 'number') return false;
    const requested = validateQuery(value.requested);
    if (key && recordingKey(requested) !== key) return false;
    let previous = -1;
    for (const line of value.synced) {
      if (!line || !Number.isFinite(line.time) || line.time < 0 || line.time > 86400 || line.time < previous ||
        !Array.isArray(line.words) || line.words.length === 0 || line.words.length > 2048 ||
        line.words.some((word) => typeof word !== 'string' || !word.trim() || word.length > 10000)) return false;
      previous = line.time;
    }
    if (value.timing !== (value.synced.length > 0 ? 'line' : 'none')) return false;
    const success = value.status === 'found' || value.status === 'instrumental';
    if (!success) return value.text === '' && value.synced.length === 0 && value.songInfo === null &&
      value.source === null && value.sourceUrl === null && value.confidence === 'none';
    if (!validSongInfo(value.songInfo) || !value.songInfo.title || !value.songInfo.artist) return false;
    if (value.status === 'instrumental' && (value.text !== '' || value.synced.length !== 0)) return false;
    if (value.status === 'found' && !value.text.trim() && value.synced.length === 0) return false;
    const sourceUrl = new URL(value.sourceUrl);
    if (sourceUrl.protocol !== 'https:' || sourceUrl.username || sourceUrl.password || sourceUrl.port) return false;
    if (value.source === 'lrclib.net') return sourceUrl.hostname === 'lrclib.net' &&
      ['exact', 'matched'].includes(value.confidence) && normalize(value.songInfo.title) === normalize(requested.title) &&
      normalize(value.songInfo.artist) === normalize(requested.artist) &&
      (!versionSensitive(value.songInfo) || versionSensitive(requested)) &&
      (!requested.album || normalize(value.songInfo.album) === normalize(requested.album)) &&
      (!requested.duration || (value.songInfo.duration > 0 && Math.abs(requested.duration - value.songInfo.duration) <= 2000));
    return value.source === 'lyrics.ovh' && sourceUrl.hostname === 'api.lyrics.ovh' &&
      value.confidence === 'title-artist' && value.timing === 'none' && value.status === 'found' &&
      !versionSensitive(requested) &&
      normalize(value.songInfo.title) === normalize(requested.title) && normalize(value.songInfo.artist) === normalize(requested.artist);
  } catch {
    return false;
  }
}

module.exports = { MAX_BYTES, normalize, validateQuery, recordingKey, isLyricsResult, versionSensitive };
