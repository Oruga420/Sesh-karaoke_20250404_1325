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
  const hasHappiKey = !!process.env.HAPPI_API_KEY;
  
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
      happi_api_key: hasHappiKey ? 'set' : 'not set'
    },
    serverInfo: {
      platform: process.platform,
      version: process.version,
      serverless: true,
    },
    apis: {
      lyrics: {
        url: '/api/lyrics',
        method: 'GET',
        parameters: 'title, artist',
        status: hasHappiKey ? 'active' : 'fallback mode',
        provider: 'Happi.dev',
        configured: hasHappiKey,
        testUrl: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host || 'unknown'}/api/lyrics?title=Test&artist=Artist`
      },
      debug: {
        url: '/api/debug',
        method: 'GET',
        status: 'active'
      },
      directLyrics: {
        url: '/api/direct-lyrics',
        method: 'GET',
        parameters: 'title, artist',
        status: 'active',
        testUrl: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host || 'unknown'}/api/direct-lyrics?title=Test&artist=Artist`
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
  
  // Return the debug info
  res.status(200).json(debug);
};