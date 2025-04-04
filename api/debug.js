const axios = require('axios');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Check if Happi.dev API key is configured
  const happiApiKey = process.env.HAPPI_API_KEY;
  const hasHappiKey = !!happiApiKey;
  
  // Return comprehensive debug information
  const debug = {
    timestamp: new Date().toISOString(),
    request: {
      url: req.url,
      headers: req.headers,
      host: req.headers.host || 'unknown',
      origin: req.headers.origin || 'unknown',
      referer: req.headers.referer || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown'
    },
    env: {
      node_env: process.env.NODE_ENV || 'development',
      api_url: process.env.REACT_APP_API_URL || '(not set)',
      spotify_client_id: process.env.REACT_APP_SPOTIFY_CLIENT_ID ? 'set' : 'not set',
      happi_api_key: hasHappiKey ? 'set' : 'not set',
      happi_key_length: happiApiKey ? happiApiKey.length : 0,
      happi_key_preview: happiApiKey ? `${happiApiKey.substring(0, 5)}...${happiApiKey.substring(happiApiKey.length - 3)}` : 'not set',
    },
    serverInfo: {
      platform: process.platform,
      version: process.version,
      serverless: true,
    },
    apis: {
      lyrics: {
        url: '/lyrics',
        fullUrl: '/api/lyrics.js',
        method: 'GET',
        parameters: 'title, artist',
        status: hasHappiKey ? 'active' : 'fallback mode',
        provider: 'Happi.dev',
        configured: hasHappiKey,
        testUrl: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host || 'unknown'}/lyrics?title=Test&artist=Artist`
      },
      debug: {
        url: '/debug',
        fullUrl: '/api/debug.js',
        method: 'GET',
        status: 'active'
      },
      directLyrics: {
        url: '/direct-lyrics',
        fullUrl: '/api/direct-lyrics.js',
        method: 'GET',
        parameters: 'title, artist',
        status: 'active',
        testUrl: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host || 'unknown'}/direct-lyrics?title=Test&artist=Artist`
      }
    },
    happiApi: {
      configured: hasHappiKey,
      status: hasHappiKey ? 'Ready to use' : 'API key not set',
      freePlan: '10,000 requests per month',
      documentation: 'https://happi.dev/docs/music'
    },
    troubleshooting: {
      frontendChecks: [
        "Open browser console to see detailed logs",
        "Verify the API_URL is correctly set in the frontend",
        "Check if CORS is preventing API requests"
      ],
      apiChecks: [
        "Verify Happi.dev API key is set in your environment variables",
        "Test the API directly using the testUrl values above",
        "Check server logs for any errors"
      ],
      directLyrics: "Use the direct-lyrics endpoint for testing - it doesn't require an API key"
    }
  };
  
  // Test Happi API if requested
  if (req.query.testHappi === 'true') {
    try {
      if (!happiApiKey) {
        debug.happiTest = {
          success: false,
          error: 'No Happi API key found in environment variables'
        };
      } else {
        // Test artist and title
        const artist = req.query.artist || 'Don Omar';
        const title = req.query.title || 'Conteo';
        
        debug.happiTest = {
          status: 'Testing Happi API...',
          apiKeyFound: true,
          apiKeyPreview: `${happiApiKey.substring(0, 5)}...${happiApiKey.substring(happiApiKey.length - 3)}`,
          testQuery: { artist, title }
        };
        
        // Make test request to Happi API
        const searchResponse = await axios.get('https://api.happi.dev/v1/music/search', {
          params: {
            q: `${artist} ${title}`,
            limit: 1,
            apikey: happiApiKey
          },
          headers: {
            'x-happi-key': happiApiKey
          }
        });
        
        debug.happiTest.searchResponse = {
          status: searchResponse.status,
          success: searchResponse.data.success,
          resultCount: searchResponse.data.result ? searchResponse.data.result.length : 0,
          firstResult: searchResponse.data.result && searchResponse.data.result.length > 0 ? 
            {
              track: searchResponse.data.result[0].track,
              artist: searchResponse.data.result[0].artist,
              hasLyricsApi: !!searchResponse.data.result[0].api_lyrics
            } : null,
          completeResult: searchResponse.data
        };
        
        // If we found a track, try to get lyrics
        if (searchResponse.data.success && 
            searchResponse.data.result && 
            searchResponse.data.result.length > 0 &&
            searchResponse.data.result[0].api_lyrics) {
          
          const lyricsUrl = searchResponse.data.result[0].api_lyrics;
          const lyricsResponse = await axios.get(lyricsUrl, {
            headers: {
              'x-happi-key': happiApiKey
            }
          });
          
          debug.happiTest.lyricsResponse = {
            status: lyricsResponse.status,
            success: lyricsResponse.data.success,
            hasLyrics: !!lyricsResponse.data.result && !!lyricsResponse.data.result.lyrics,
            preview: lyricsResponse.data.result && lyricsResponse.data.result.lyrics ? 
              lyricsResponse.data.result.lyrics.substring(0, 100) + '...' : null,
            completeResult: lyricsResponse.data
          };
        }
      }
    } catch (error) {
      debug.happiTest = {
        success: false,
        error: error.message,
        stack: error.stack,
        response: error.response ? {
          status: error.response.status,
          data: error.response.data
        } : null
      };
    }
  }
  
  // Return the debug info
  res.status(200).json(debug);
};