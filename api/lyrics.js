// Lyrics API: prefers lrclib.net (real synced LRC timestamps),
// falls back to Happi.dev plain text only if no synced lyrics are found.
const axios = require('axios');
const { parseLrc } = require('./lrcParser');

const LRCLIB_BASE = 'https://lrclib.net/api';
const HAPPI_API_BASE = 'https://api.happi.dev/v1/music';

const DEBUG = true;

// In-memory cache (per serverless instance)
const cache = new Map();
const CACHE_TTL = 3600000; // 1 hour

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { title = '', artist = '', album = '', duration = '' } = req.query;

  if (!title || !artist) {
    return res.status(400).json({
      error: 'Missing parameters',
      message: 'Both title and artist parameters are required',
    });
  }

  if (DEBUG) {
    console.log(`[lyrics] Request: "${title}" by "${artist}" (album="${album}", duration=${duration})`);
  }

  // Cache key includes duration so different recordings of the same title don't collide
  const cacheKey = `${title}::${artist}::${duration}`.toLowerCase();
  if (cache.has(cacheKey)) {
    if (DEBUG) console.log(`[lyrics] Cache hit: ${cacheKey}`);
    return res.status(200).json({ lyrics: cache.get(cacheKey) });
  }

  try {
    // 1. Try lrclib (real synced LRC) — this is what makes timing actually match the song
    const lrcResult = await fetchFromLrcLib({ title, artist, album, duration });
    if (lrcResult && lrcResult.synced && lrcResult.synced.length > 0) {
      cacheAndReturn(res, cacheKey, lrcResult);
      return;
    }

    // 2. Fall back to Happi (plain text only — timing is ESTIMATED, not real)
    const happiKey = process.env.HAPPI_API_KEY;
    if (happiKey) {
      try {
        const happiResult = await getLyricsFromHappi(title, artist, happiKey);
        if (happiResult && happiResult.synced && happiResult.synced.length > 0) {
          cacheAndReturn(res, cacheKey, happiResult);
          return;
        }
      } catch (happiError) {
        console.error(`[lyrics] Happi fallback failed: ${happiError.message}`);
      }
    } else if (DEBUG) {
      console.log('[lyrics] No HAPPI_API_KEY configured, skipping Happi fallback');
    }

    // 3. Final fallback: synthetic placeholder
    return res.status(200).json({ lyrics: createFallbackLyrics(title, artist) });
  } catch (error) {
    console.error(`[lyrics] Server error: ${error.message}`);
    return res.status(200).json({ lyrics: createFallbackLyrics(title, artist) });
  }
};

function cacheAndReturn(res, cacheKey, lyrics) {
  cache.set(cacheKey, lyrics);
  setTimeout(() => cache.delete(cacheKey), CACHE_TTL);
  res.status(200).json({ lyrics });
}

// Fetch from lrclib.net — returns real synced LRC timestamps that match the recording
async function fetchFromLrcLib({ title, artist, album, duration }) {
  try {
    const params = {
      artist_name: artist,
      track_name: title,
    };
    if (album) params.album_name = album;
    // lrclib expects duration in seconds
    if (duration) {
      const durSec = Math.floor(Number(duration) / 1000);
      if (Number.isFinite(durSec) && durSec > 0) params.duration = durSec;
    }

    const url = `${LRCLIB_BASE}/get?${new URLSearchParams(params)}`;
    if (DEBUG) console.log(`[lrclib] GET ${url}`);

    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Spotify-Karaoke-App (https://github.com/Oruga420/Sesh-karaoke_20250404_1325)' },
      timeout: 10000,
      validateStatus: (status) => status === 200 || status === 404,
    });

    if (response.status === 404) {
      // /get is exact match; try /search for fuzzy
      return await searchLrcLib({ title, artist });
    }

    return parseLrcLibResponse(response.data);
  } catch (error) {
    console.error(`[lrclib] Error: ${error.message}`);
    return null;
  }
}

async function searchLrcLib({ title, artist }) {
  try {
    const params = new URLSearchParams({
      track_name: title,
      artist_name: artist,
    });
    const url = `${LRCLIB_BASE}/search?${params}`;
    if (DEBUG) console.log(`[lrclib] Search ${url}`);

    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Spotify-Karaoke-App' },
      timeout: 10000,
      validateStatus: (status) => status === 200 || status === 404,
    });

    if (response.status !== 200 || !Array.isArray(response.data) || response.data.length === 0) {
      return null;
    }

    // Prefer the first result that has syncedLyrics
    const withSynced = response.data.find((r) => r.syncedLyrics && r.syncedLyrics.length > 0);
    const best = withSynced || response.data[0];
    return parseLrcLibResponse(best);
  } catch (error) {
    console.error(`[lrclib] Search error: ${error.message}`);
    return null;
  }
}

function parseLrcLibResponse(data) {
  if (!data) return null;
  const synced = data.syncedLyrics ? parseLrc(data.syncedLyrics) : [];
  const text = data.plainLyrics || synced.map((l) => l.words.join(' ')).join('\n');
  if (synced.length === 0 && !text) return null;

  return {
    text,
    synced,
    source: 'lrclib.net',
    songInfo: {
      title: data.trackName || '',
      artist: data.artistName || '',
      album: data.albumName || '',
    },
  };
}

// Happi fallback (plain text → estimated timing — last resort only)
async function getLyricsFromHappi(title, artist, apiKey) {
  const cleanTitle = title.replace(/\(.*?\)/g, '').trim();
  const cleanArtist = artist.replace(/\(.*?\)/g, '').trim();

  const searchResponse = await axios.get(`${HAPPI_API_BASE}/search`, {
    params: { q: `${cleanArtist} ${cleanTitle}`, limit: 5, apikey: apiKey },
    headers: { 'x-happi-key': apiKey },
    timeout: 5000,
  });

  if (!searchResponse.data.success || !searchResponse.data.result || searchResponse.data.result.length === 0) {
    throw new Error('Happi: no results');
  }

  const results = searchResponse.data.result;
  const exact = results.find(
    (r) =>
      r.track.toLowerCase().includes(cleanTitle.toLowerCase()) &&
      r.artist.toLowerCase().includes(cleanArtist.toLowerCase())
  );
  const best = exact || results[0];

  const lyricsResponse = await axios.get(best.api_lyrics, {
    headers: { 'x-happi-key': apiKey },
    timeout: 5000,
  });

  if (!lyricsResponse.data.success || !lyricsResponse.data.result) {
    throw new Error('Happi: no lyrics body');
  }

  const lyricsText = lyricsResponse.data.result.lyrics;
  return {
    text: lyricsText,
    synced: estimateSyncFromPlainText(lyricsText),
    source: 'happi-dev (estimated timing)',
    songInfo: {
      title: best.track,
      artist: best.artist,
      album: best.album || 'Unknown Album',
    },
  };
}

// Estimate timing from plain text (NOT real sync — only used when no LRC source has the song)
function estimateSyncFromPlainText(lyricsText) {
  const lines = lyricsText.split('\n').filter((l) => l.trim());
  const synced = [];
  let currentTime = 6; // small intro buffer

  for (const line of lines) {
    const words = line.split(/\s+/).filter((w) => w.trim());
    if (words.length === 0) continue;
    synced.push({ time: currentTime, words });
    currentTime += Math.max(2, Math.min(4, words.length * 0.5));
  }
  return synced;
}

function createFallbackLyrics(title, artist) {
  return {
    text: `${title}\nBy ${artist}\n\nLyrics unavailable\nNo synced lyrics found on lrclib.net`,
    synced: [
      { time: 0, words: [title] },
      { time: 3, words: ['By', artist] },
      { time: 6, words: ['Lyrics', 'unavailable'] },
      { time: 9, words: ['No', 'synced', 'lyrics', 'found'] },
    ],
    source: 'fallback',
  };
}
