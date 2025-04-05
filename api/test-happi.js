// Direct test endpoint for Happi API with detailed error reporting
const axios = require('axios');

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
  
  const HAPPI_API_BASE = 'https://api.happi.dev/v1/music';
  
  // Hard-coded test API key (for development only)
  const TEST_API_KEY = "hk205-bmv8eRuDe1gzEEgGeErKZj3ETvMZke9VBV";
  
  // Get request parameters
  const { title = 'Blinding Lights', artist = 'The Weeknd', useTestKey = 'false' } = req.query;
  
  // Use environment key or test key
  const apiKey = useTestKey === 'true' ? TEST_API_KEY : process.env.HAPPI_API_KEY;
  
  const response = {
    timestamp: new Date().toISOString(),
    apiKeyInfo: {
      source: useTestKey === 'true' ? 'test key' : 'environment',
      available: !!apiKey,
      length: apiKey ? apiKey.length : 0,
      preview: apiKey ? `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 3)}` : null
    },
    query: { title, artist }
  };
  
  if (!apiKey) {
    response.error = 'No API key available';
    return res.status(200).json(response);
  }
  
  try {
    // Test 1: Simple API endpoint test
    console.log('Testing simple API endpoint');
    try {
      const simpleTest = await axios.get(`${HAPPI_API_BASE}/artists/drake`, {
        params: { apikey: apiKey },
        headers: { 'x-happi-key': apiKey },
        timeout: 5000 // 5 second timeout
      });
      
      response.basicTest = {
        success: true,
        status: simpleTest.status,
        data: simpleTest.data ? 'Valid response' : 'Empty response'
      };
    } catch (basicError) {
      response.basicTest = {
        success: false,
        error: basicError.message,
        status: basicError.response ? basicError.response.status : null,
        data: basicError.response ? basicError.response.data : null
      };
    }
    
    // Test 2: Search for song
    console.log('Testing song search');
    try {
      const searchResponse = await axios.get(`${HAPPI_API_BASE}/search`, {
        params: {
          q: `${artist} ${title}`,
          limit: 5,
          apikey: apiKey
        },
        headers: {
          'x-happi-key': apiKey
        }
      });
      
      response.searchTest = {
        success: true,
        status: searchResponse.status,
        resultCount: searchResponse.data.result ? searchResponse.data.result.length : 0
      };
      
      // If search successful, try to get lyrics
      if (searchResponse.data.success && 
          searchResponse.data.result && 
          searchResponse.data.result.length > 0 &&
          searchResponse.data.result[0].api_lyrics) {
        
        console.log('Testing lyrics fetch');
        const lyricsUrl = searchResponse.data.result[0].api_lyrics;
        
        try {
          const lyricsResponse = await axios.get(lyricsUrl, {
            headers: {
              'x-happi-key': apiKey
            }
          });
          
          response.lyricsTest = {
            success: true,
            status: lyricsResponse.status,
            hasLyrics: !!lyricsResponse.data.result && !!lyricsResponse.data.result.lyrics,
            sample: lyricsResponse.data.result && lyricsResponse.data.result.lyrics ? 
              lyricsResponse.data.result.lyrics.substring(0, 100) + '...' : null
          };
        } catch (lyricsError) {
          response.lyricsTest = {
            success: false,
            error: lyricsError.message,
            status: lyricsError.response ? lyricsError.response.status : null,
            data: lyricsError.response ? lyricsError.response.data : null
          };
        }
      } else {
        response.lyricsTest = {
          skipped: true,
          reason: 'No lyrics URL found in search results'
        };
      }
    } catch (searchError) {
      response.searchTest = {
        success: false,
        error: searchError.message,
        status: searchError.response ? searchError.response.status : null,
        data: searchError.response ? searchError.response.data : null
      };
    }
    
    // Return all test results
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
};