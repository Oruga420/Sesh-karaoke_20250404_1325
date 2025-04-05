// Clean lyrics API implementation using Happi.dev
const axios = require('axios');

// Happi.dev API base URL
const HAPPI_API_BASE = 'https://api.happi.dev/v1/music';

// Debug mode
const DEBUG = true;

// Hard-coded test API key (for development only)
const TEST_API_KEY = "hk205-bmv8eRuDe1gzEEgGeErKZj3ETvMZke9VBV";

// Simple in-memory cache to reduce API calls
const cache = new Map();
const CACHE_TTL = 3600000; // 1 hour in milliseconds

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Get request parameters
    const { title = '', artist = '' } = req.query;
    
    if (!title || !artist) {
      return res.status(400).json({ 
        error: 'Missing parameters',
        message: 'Both title and artist parameters are required' 
      });
    }
    
    console.log(`[lyrics] Request for: "${title}" by "${artist}"`);
    
    // Check cache first
    const cacheKey = `${title}:${artist}`.toLowerCase();
    if (cache.has(cacheKey)) {
      console.log(`[lyrics] Cache hit for: "${title}" by "${artist}"`);
      return res.status(200).json({ lyrics: cache.get(cacheKey) });
    }
    
    // Get Happi.dev API key
    let apiKey = process.env.HAPPI_API_KEY;
    
    // Debug output
    if (DEBUG) {
      console.log('[lyrics] HAPPI_API_KEY found:', !!apiKey);
      console.log('[lyrics] HAPPI_API_KEY length:', apiKey ? apiKey.length : 0);
      if (apiKey) {
        console.log('[lyrics] HAPPI_API_KEY preview:', `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 3)}`);
      }
    }
    
    // Check direct query string override for testing (NEVER use in production)
    if (req.query.testApiKey && req.query.testApiKey === 'true') {
      apiKey = TEST_API_KEY;
      console.log('[lyrics] Using test API key from query string');
    }
    
    // Force test mode if explicitly requested
    if (req.query.forceTest === 'true') {
      console.log('[lyrics] Force test mode enabled, ignoring environment API key');
      apiKey = TEST_API_KEY;
    }
    
    // Fallback for testing
    if (!apiKey) {
      // Try a hardcoded key for testing - remove in production!
      apiKey = TEST_API_KEY;
      console.log('[lyrics] No HAPPI_API_KEY in env, using fallback test key');
    }
    
    // If still no key, try direct lyrics first before fallback
    if (!apiKey) {
      console.error('[lyrics] No Happi.dev API key found or fallback available');
      
      // Try using direct lyrics as a backup
      try {
        const directLyricsUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host || 'localhost'}/direct-lyrics`;
        console.log(`[lyrics] Trying direct lyrics at: ${directLyricsUrl}`);
        
        const axios = require('axios');
        const directResponse = await axios.get(directLyricsUrl, {
          params: { title, artist },
          timeout: 3000
        });
        
        if (directResponse.data && directResponse.data.lyrics) {
          console.log('[lyrics] Using direct lyrics as fallback');
          return res.status(200).json(directResponse.data);
        }
      } catch (directError) {
        console.error('[lyrics] Direct lyrics fallback failed:', directError.message);
      }
      
      // If direct lyrics failed, return standard fallback
      return res.status(200).json({ lyrics: createFallbackLyrics(title, artist) });
    }
    
    // Search for the song
    try {
      // Test the API key first with a simple request if debug mode enabled
      if (DEBUG && req.query.debug === 'true') {
        console.log('[lyrics] Testing API key before full lyrics request...');
        try {
          const testResponse = await axios.get(`${HAPPI_API_BASE}/artists/celine-dion`, {
            params: { apikey: apiKey },
            headers: { 'x-happi-key': apiKey }
          });
          console.log('[lyrics] Test request successful:', testResponse.status);
        } catch (testError) {
          console.error('[lyrics] Test request failed:', testError.message);
          if (testError.response) {
            console.error('[lyrics] Test response:', testError.response.status, testError.response.data);
          }
          // Still proceed with the actual lyrics request
        }
      }
      
      const lyrics = await getLyricsFromHappi(title, artist, apiKey);
      
      // Cache the result
      cache.set(cacheKey, lyrics);
      setTimeout(() => cache.delete(cacheKey), CACHE_TTL);
      
      return res.status(200).json({ lyrics });
    } catch (error) {
      console.error(`[lyrics] Happi.dev API error: ${error.message}`);
      
      // Provide more detailed error information in debug mode
      if (DEBUG && req.query.debug === 'true') {
        const errorDetails = {
          message: error.message,
          stack: error.stack,
          response: error.response ? {
            status: error.response.status,
            data: error.response.data
          } : null
        };
        
        return res.status(200).json({ 
          lyrics: createFallbackLyrics(title, artist),
          debug: errorDetails 
        });
      }
      
      return res.status(200).json({ lyrics: createFallbackLyrics(title, artist) });
    }
  } catch (error) {
    console.error(`[lyrics] Server error: ${error.message}`);
    return res.status(200).json({ lyrics: createFallbackLyrics(title, artist) });
  }
};

// Get lyrics from Happi.dev API
async function getLyricsFromHappi(title, artist, apiKey) {
  // Clean up title and artist
  const cleanTitle = title.replace(/\(.*?\)/g, '').trim();
  const cleanArtist = artist.replace(/\(.*?\)/g, '').trim();
  
  // Debug search request
  if (DEBUG) {
    console.log(`[lyrics] Searching for: "${cleanArtist} ${cleanTitle}" with Happi API`);
    console.log(`[lyrics] Search URL: ${HAPPI_API_BASE}/search`);
    console.log(`[lyrics] Using API key: ${apiKey.substring(0, 5)}...`);
  }
  
  // Search for the song
  const searchResponse = await axios.get(`${HAPPI_API_BASE}/search`, {
    params: {
      q: `${cleanArtist} ${cleanTitle}`,
      limit: 5,
      apikey: apiKey
    },
    headers: {
      'x-happi-key': apiKey
    }
  });
  
  // Debug search response
  if (DEBUG) {
    console.log(`[lyrics] Search response status: ${searchResponse.status}`);
    console.log(`[lyrics] Search success: ${searchResponse.data.success}`);
    console.log(`[lyrics] Found results: ${searchResponse.data.result ? searchResponse.data.result.length : 0}`);
  }
  
  // Check if we found any results
  if (!searchResponse.data.success || !searchResponse.data.result || searchResponse.data.result.length === 0) {
    throw new Error('No results found');
  }
  
  // Find the best match
  const searchResults = searchResponse.data.result;
  let bestMatch = null;
  
  // Try to find an exact match first
  for (const result of searchResults) {
    if (result.track.toLowerCase().includes(cleanTitle.toLowerCase()) && 
        result.artist.toLowerCase().includes(cleanArtist.toLowerCase())) {
      bestMatch = result;
      break;
    }
  }
  
  // If no exact match, use the first result
  if (!bestMatch && searchResults.length > 0) {
    bestMatch = searchResults[0];
  }
  
  if (!bestMatch) {
    throw new Error('No suitable match found');
  }
  
  // Get the lyrics
  const lyricsResponse = await axios.get(bestMatch.api_lyrics, {
    headers: {
      'x-happi-key': apiKey
    }
  });
  
  if (!lyricsResponse.data.success || !lyricsResponse.data.result) {
    throw new Error('No lyrics found');
  }
  
  const lyricsText = lyricsResponse.data.result.lyrics;
  
  // Create synced lyrics
  return {
    text: lyricsText,
    synced: createSyncedLyrics(lyricsText, title, artist),
    source: 'happi-dev',
    songInfo: {
      title: bestMatch.track,
      artist: bestMatch.artist,
      album: bestMatch.album || 'Unknown Album'
    }
  };
}

// Create synced lyrics from text
function createSyncedLyrics(lyricsText, title, artist) {
  // Split lyrics into lines
  const lines = lyricsText.split('\n').filter(line => line.trim());
  
  // Create synced lyrics array
  const synced = [];
  
  // Add title and artist as first lines
  synced.push({ time: 0, words: [title] });
  synced.push({ time: 3, words: ["By", artist] });
  
  // Add each line with timing
  let currentTime = 6;
  lines.forEach((line) => {
    if (!line.trim()) return;
    
    const words = line.split(' ').filter(w => w.trim());
    if (words.length > 0) {
      synced.push({
        time: currentTime,
        words: words
      });
      
      // Adjust timing based on line length
      currentTime += Math.max(2, Math.min(4, words.length * 0.5));
    }
  });
  
  return synced;
}

// Create fallback lyrics when API fails
function createFallbackLyrics(title, artist) {
  return {
    text: `${title}\nBy ${artist}\n\nLyrics unavailable\nPlease check your Happi.dev API key\nor try again later`,
    synced: [
      { time: 0, words: [title] },
      { time: 3, words: ["By", artist] },
      { time: 6, words: ["Lyrics", "unavailable"] },
      { time: 9, words: ["Please", "check", "your", "Happi.dev", "API", "key"] },
      { time: 12, words: ["or", "try", "again", "later"] }
    ],
    source: 'fallback'
  };
}