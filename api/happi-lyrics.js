// Enhanced Happi.dev API integration for reliable lyrics
const axios = require('axios');

// The Happi.dev API base URL
const HAPPI_API_BASE = 'https://api.happi.dev/v1/music';

// In-memory cache for lyrics to reduce API calls
const lyricsCache = new Map();

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,OPTIONS,PATCH,DELETE,POST,PUT'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Extract query parameters
    const { title, artist } = req.query;
    
    if (!title || !artist) {
      return res.status(400).json({ error: 'Title and artist are required' });
    }
    
    // Clean up title and artist for better matching
    const cleanTitle = cleanString(title);
    const cleanArtist = cleanString(artist);
    
    // Check cache first - generate cache key
    const cacheKey = `${cleanArtist}:${cleanTitle}`.toLowerCase();
    
    if (lyricsCache.has(cacheKey)) {
      console.log(`[happi] Cache hit for "${title}" by "${artist}"`);
      return res.status(200).json({
        lyrics: lyricsCache.get(cacheKey)
      });
    }
    
    // Get API key from environment variable
    const apiKey = process.env.HAPPI_API_KEY;
    
    if (!apiKey) {
      console.error('[happi] API key is not set');
      // Fall back to direct lyrics if API key is not available
      const directLyricsHandler = require('./direct-lyrics');
      return directLyricsHandler(req, res);
    }
    
    console.log(`[happi] Searching for: "${title}" by "${artist}"`);
    
    try {
      // Try both search methods to improve match success rate
      const lyrics = await tryMultipleSearchMethods(cleanTitle, cleanArtist, apiKey);
      
      if (lyrics) {
        // Save to cache (10 minute expiry)
        lyricsCache.set(cacheKey, lyrics);
        setTimeout(() => lyricsCache.delete(cacheKey), 600000); // 10 minutes
        
        return res.status(200).json({
          lyrics: lyrics
        });
      }
    } catch (searchError) {
      console.error('[happi] Search error:', searchError.message);
    }
    
    // If we get here, all search methods failed
    console.log(`[happi] All methods failed, falling back to direct lyrics`);
    const directLyricsHandler = require('./direct-lyrics');
    return directLyricsHandler(req, res);
    
  } catch (error) {
    console.error('[happi] Error:', error);
    
    // Always fall back to direct lyrics on any error
    const directLyricsHandler = require('./direct-lyrics');
    return directLyricsHandler(req, res);
  }
};

// Try multiple search methods to find the best lyrics
async function tryMultipleSearchMethods(title, artist, apiKey) {
  // Method 1: Combined search query
  try {
    const result = await searchByQueryString(`${artist} ${title}`, apiKey);
    if (result) return result;
  } catch (err) {
    console.log(`[happi] Combined search failed: ${err.message}`);
  }
  
  // Method 2: Direct artist and track search
  try {
    const result = await searchByArtistAndTrack(artist, title, apiKey);
    if (result) return result;
  } catch (err) {
    console.log(`[happi] Artist/track search failed: ${err.message}`);
  }
  
  // Method 3: Just use the title for very popular songs
  try {
    const result = await searchByQueryString(title, apiKey);
    if (result) return result;
  } catch (err) {
    console.log(`[happi] Title-only search failed: ${err.message}`);
  }
  
  // No results from any method
  return null;
}

// Search by combined query string
async function searchByQueryString(query, apiKey) {
  const searchResponse = await axios.get(`${HAPPI_API_BASE}/search`, {
    params: {
      q: query,
      limit: 10, // Increased to find more potential matches
      apikey: apiKey
    },
    headers: {
      'x-happi-key': apiKey
    }
  });
  
  if (!searchResponse.data.success || !searchResponse.data.result || searchResponse.data.result.length === 0) {
    throw new Error('No results found');
  }
  
  return await processSearchResults(searchResponse.data.result, apiKey);
}

// Search by artist and track directly
async function searchByArtistAndTrack(artist, title, apiKey) {
  const searchResponse = await axios.get(`${HAPPI_API_BASE}/artists/${encodeURIComponent(artist)}/tracks/${encodeURIComponent(title)}`, {
    params: {
      apikey: apiKey
    },
    headers: {
      'x-happi-key': apiKey
    }
  });
  
  if (!searchResponse.data.success || !searchResponse.data.result) {
    throw new Error('No direct match found');
  }
  
  return await getLyricsFromApiUrl(searchResponse.data.result.api_lyrics, apiKey);
}

// Process search results and get lyrics
async function processSearchResults(results, apiKey) {
  // No results
  if (!results || results.length === 0) {
    return null;
  }
  
  // Just use the first result - simplifies logic
  const bestMatch = results[0];
  
  console.log(`[happi] Best match: "${bestMatch.track}" by "${bestMatch.artist}"`);
  
  // Get the lyrics
  return await getLyricsFromApiUrl(bestMatch.api_lyrics, apiKey);
}

// Get lyrics from a lyrics API URL
async function getLyricsFromApiUrl(apiUrl, apiKey) {
  const lyricsResponse = await axios.get(apiUrl, {
    headers: {
      'x-happi-key': apiKey
    }
  });
  
  if (!lyricsResponse.data.success || !lyricsResponse.data.result) {
    throw new Error('No lyrics found');
  }
  
  const lyricsText = lyricsResponse.data.result.lyrics;
  
  // Extract the original artist and title from the result
  const trackTitle = lyricsResponse.data.result.track || '';
  const artistName = lyricsResponse.data.result.artist || '';
  
  // Create synced lyrics
  const syncedLyrics = createTimedLyrics(lyricsText, trackTitle, artistName);
  
  return {
    text: lyricsText,
    synced: syncedLyrics,
    source: 'happi-dev',
    meta: {
      artist: artistName,
      title: trackTitle
    }
  };
}

// Create timed lyrics from text lyrics
function createTimedLyrics(lyricsText, title, artist) {
  // Clean up lyrics text and split into lines
  const lines = lyricsText
    .split('\n')
    .filter(line => line.trim());
  
  // Create a synced structure
  const synced = [];
  
  // Add title and artist as first lines
  synced.push({ 
    time: 0, 
    words: [title || "Unknown Title"]
  });
  
  synced.push({
    time: 3,
    words: ["By", artist || "Unknown Artist"]
  });
  
  // Intelligently estimate song duration based on lyrics length
  // Average reading speed is about 3 words per second for lyrics
  const wordCount = lines.reduce((count, line) => count + line.split(' ').length, 0);
  const estimatedSongDuration = Math.max(
    180, // Minimum 3 minutes
    Math.min(
      360, // Maximum 6 minutes
      30 + (wordCount / 3) // 30 seconds + time to sing all words
    )
  );
  
  const timeForLyrics = estimatedSongDuration - 6; // Reserve first 6 seconds for title and artist
  
  // Calculate time per line, with more time for longer lines
  const lineLengths = lines.map(line => Math.max(1, line.split(' ').length));
  const totalLengthUnits = lineLengths.reduce((sum, len) => sum + len, 0);
  
  let currentTime = 6; // Start after title and artist
  
  // Add each line with a proportional timestamp
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    
    const words = line.split(' ').filter(w => w.trim());
    if (words.length === 0) return;
    
    // Calculate time for this line based on its length
    const lineTimeShare = (lineLengths[index] / totalLengthUnits) * timeForLyrics;
    
    synced.push({
      time: Math.round(currentTime * 10) / 10, // Round to 1 decimal place
      words: words
    });
    
    currentTime += lineTimeShare;
  });
  
  return synced;
}

// Helper function to clean strings for better matching
function cleanString(str) {
  if (!str) return '';
  return str
    .replace(/\(.*?\)/g, '') // Remove content in parentheses
    .replace(/\[.*?\]/g, '') // Remove content in brackets
    .replace(/feat\..*$/i, '') // Remove "feat." and everything after
    .replace(/ft\..*$/i, '') // Remove "ft." and everything after
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();
}