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
  
  // Load popular songs for debug info
  let popularSongs = [];
  try {
    const popularSongsModule = require('./popular-songs');
    if (popularSongsModule && popularSongsModule.songs) {
      // Count the songs and extract just names
      popularSongs = popularSongsModule.songs.map(song => ({
        title: song.title,
        artist: song.artist
      }));
    }
  } catch (err) {
    popularSongs = [{title: 'Error', artist: 'Could not load popular songs data'}];
  }
  
  // Return enhanced debug information
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
    },
    apis: {
      lyrics: {
        url: '/api/lyrics',
        method: 'GET',
        parameters: 'title, artist',
        status: 'active',
        implementation: 'Redirects to direct-lyrics for better reliability'
      },
      directLyrics: {
        url: '/api/direct-lyrics',
        method: 'GET',
        parameters: 'title, artist',
        status: 'active',
        description: 'Reliable lyrics provider with built-in popular songs',
        popularSongsCount: popularSongs.length,
        popularSongsList: popularSongs
      }
    },
    recommendations: "Use /api/direct-lyrics endpoint for most reliable lyrics fetching"
  };
  
  // Return the debug info
  res.status(200).json(debug);
};