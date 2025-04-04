// Test Happi API integration
const axios = require('axios');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Get API key from environment
    const apiKey = process.env.HAPPI_API_KEY;
    
    // Test parameters
    const artist = req.query.artist || 'Don Omar';
    const title = req.query.title || 'Conteo';
    
    // Return base debug info
    const response = {
      timestamp: new Date().toISOString(),
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey ? apiKey.length : 0,
      apiKeyPreview: apiKey ? `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 3)}` : null,
      query: { artist, title }
    };
    
    // Only proceed if we have an API key
    if (!apiKey) {
      response.error = 'No Happi API key found';
      return res.status(200).json(response);
    }
    
    // Test the basic search
    const searchResponse = await axios.get('https://api.happi.dev/v1/music/search', {
      params: {
        q: `${artist} ${title}`,
        limit: 5,
        apikey: apiKey
      },
      headers: {
        'x-happi-key': apiKey
      }
    });
    
    // Process search results
    response.search = {
      status: searchResponse.status,
      success: searchResponse.data.success,
      count: searchResponse.data.result ? searchResponse.data.result.length : 0
    };
    
    // If we found results, get more details
    if (searchResponse.data.success && searchResponse.data.result && searchResponse.data.result.length > 0) {
      const firstResult = searchResponse.data.result[0];
      
      response.search.firstResult = {
        artist: firstResult.artist,
        track: firstResult.track,
        album: firstResult.album,
        cover: firstResult.cover,
        hasLyrics: !!firstResult.api_lyrics
      };
      
      // Try to get lyrics if available
      if (firstResult.api_lyrics) {
        try {
          const lyricsResponse = await axios.get(firstResult.api_lyrics, {
            headers: {
              'x-happi-key': apiKey
            }
          });
          
          response.lyrics = {
            status: lyricsResponse.status,
            success: lyricsResponse.data.success,
            hasLyrics: !!lyricsResponse.data.result && !!lyricsResponse.data.result.lyrics
          };
          
          // Add sample of lyrics
          if (lyricsResponse.data.success && lyricsResponse.data.result && lyricsResponse.data.result.lyrics) {
            const fullLyrics = lyricsResponse.data.result.lyrics;
            response.lyrics.sample = fullLyrics.substring(0, 500) + (fullLyrics.length > 500 ? '...' : '');
            response.lyrics.length = fullLyrics.length;
            
            // Create synced format 
            const lines = fullLyrics.split('\n');
            const syncedLyrics = [];
            let time = 0;
            
            lines.forEach(line => {
              if (line.trim()) {
                syncedLyrics.push({
                  time,
                  words: line.split(' ')
                });
                time += 3; // Add 3 seconds per line
              }
            });
            
            response.lyrics.synced = {
              count: syncedLyrics.length,
              sample: syncedLyrics.slice(0, 5)
            };
          }
        } catch (lyricsError) {
          response.lyrics = {
            error: lyricsError.message,
            stack: lyricsError.stack
          };
        }
      }
    }
    
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
};