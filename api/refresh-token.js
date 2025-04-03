const axios = require('axios');
const querystring = require('querystring');
require('dotenv').config();

// Get credentials from environment variables
const SPOTIFY_CLIENT_ID = process.env.REACT_APP_SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.REACT_APP_SPOTIFY_CLIENT_SECRET;

// Create Base64 encoded auth string required by Spotify
const getAuthHeader = () => {
  const buffer = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`);
  return `Basic ${buffer.toString('base64')}`;
};

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
    // Getting token from the request
    const refreshToken = req.body?.refreshToken || req.query?.refresh_token;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }
    
    // Prepare request to Spotify API
    const authHeader = getAuthHeader();
    const spotifyTokenUrl = 'https://accounts.spotify.com/api/token';
    
    const response = await axios.post(
      spotifyTokenUrl,
      querystring.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      }),
      {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    // Return the refreshed token
    return res.status(200).json({
      accessToken: response.data.access_token,
      expiresIn: response.data.expires_in
    });
    
  } catch (error) {
    console.error('Error refreshing token:', error);
    
    return res.status(500).json({ 
      error: 'Failed to refresh token',
      message: error.message
    });
  }
};