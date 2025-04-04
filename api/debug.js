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
  
  // Return debug information
  const debug = {
    timestamp: new Date().toISOString(),
    env: {
      node_env: process.env.NODE_ENV,
      api_url: process.env.REACT_APP_API_URL || '(not set)',
      spotify_client_id: process.env.REACT_APP_SPOTIFY_CLIENT_ID ? 'set' : 'not set'
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      query: req.query,
      body: req.body,
    },
    serverInfo: {
      platform: process.platform,
      version: process.version,
      serverless: true,
    }
  };
  
  // Return the debug info
  res.status(200).json(debug);
};