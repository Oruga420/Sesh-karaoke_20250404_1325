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
  
  // Return debug information
  const debug = {
    timestamp: new Date().toISOString(),
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
        configured: hasHappiKey
      }
    },
    happiApi: {
      configured: hasHappiKey,
      status: hasHappiKey ? 'Ready to use' : 'API key not set',
      freePlan: '10,000 requests per month',
      documentation: 'https://happi.dev/docs/music',
      endpoints: [
        'search - Find songs by title and artist',
        'lyrics - Get lyrics for a specific song'
      ]
    }
  };
  
  // Return the debug info
  res.status(200).json(debug);
};