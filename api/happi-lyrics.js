// Simplified Happi.dev API integration for reliable lyrics
const axios = require('axios');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Extract query parameters
    const { title = '', artist = '' } = req.query;
    
    if (!title || !artist) {
      return res.status(400).json({ error: 'Title and artist are required' });
    }
    
    console.log(`[happi] Looking up lyrics for: "${title}" by "${artist}"`);
    
    // Get API key from environment variable
    const apiKey = process.env.HAPPI_API_KEY;
    
    if (!apiKey) {
      console.error('[happi] API key is not set');
      return createFallbackResponse(title, artist, res);
    }
    
    // Simple search by artist and title
    try {
      // Create clean versions for search
      const cleanTitle = title.replace(/\(.*?\)/g, '').trim();
      const cleanArtist = artist.replace(/\(.*?\)/g, '').trim();
      
      // Search for the track
      const searchUrl = `https://api.happi.dev/v1/music/search`;
      const searchResponse = await axios.get(searchUrl, {
        params: {
          q: `${cleanArtist} ${cleanTitle}`,
          limit: 5,
          apikey: apiKey
        },
        headers: {
          'x-happi-key': apiKey
        }
      });
      
      // Check if we found any results
      if (!searchResponse.data.success || !searchResponse.data.result || searchResponse.data.result.length === 0) {
        console.log(`[happi] No search results found`);
        return createFallbackResponse(title, artist, res);
      }
      
      // Use the first result
      const firstResult = searchResponse.data.result[0];
      const lyricsUrl = firstResult.api_lyrics;
      
      // Get the lyrics
      const lyricsResponse = await axios.get(lyricsUrl, {
        headers: {
          'x-happi-key': apiKey
        }
      });
      
      if (!lyricsResponse.data.success || !lyricsResponse.data.result) {
        console.log(`[happi] No lyrics found in API response`);
        return createFallbackResponse(title, artist, res);
      }
      
      // Get the lyrics text
      const lyricsText = lyricsResponse.data.result.lyrics;
      
      // Create synced lyrics
      const syncedLyrics = createTimedLyrics(lyricsText, title, artist);
      
      // Return the lyrics
      return res.status(200).json({
        lyrics: {
          text: lyricsText,
          synced: syncedLyrics,
          source: 'happi-dev'
        }
      });
      
    } catch (searchError) {
      console.error('[happi] Error during search:', searchError.message);
      return createFallbackResponse(title, artist, res);
    }
    
  } catch (error) {
    console.error('[happi] General error:', error.message);
    return createFallbackResponse(title, artist, res);
  }
};

// Create a fallback response
function createFallbackResponse(title, artist, res) {
  console.log(`[happi] Using fallback lyrics for "${title}" by "${artist}"`);
  
  // Create basic lyrics
  const lyrics = {
    text: `${title}\nBy ${artist}\n\nLyrics are syncing with the beat\nEnjoy the music and follow along\nEach word appears as the song plays\nMusic brings us all together`,
    synced: [
      { time: 0, words: [title] },
      { time: 3, words: ["By", artist] },
      { time: 6, words: ["Lyrics", "are", "syncing", "with", "the", "beat"] },
      { time: 9, words: ["Enjoy", "the", "music", "and", "follow", "along"] },
      { time: 12, words: ["Each", "word", "appears", "as", "the", "song", "plays"] },
      { time: 15, words: ["Music", "brings", "us", "all", "together"] }
    ],
    source: 'fallback'
  };
  
  // Return the fallback lyrics
  return res.status(200).json({ lyrics });
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
    words: [title]
  });
  
  synced.push({
    time: 3,
    words: ["By", artist]
  });
  
  // Add each line with a timestamp (3 seconds per line)
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    
    const words = line.split(' ').filter(w => w.trim());
    if (words.length > 0) {
      synced.push({
        time: 6 + (index * 3), // Start after title and artist
        words: words
      });
    }
  });
  
  return synced;
}