const express = require('express');
const app = express();
const PORT = 8888;

// Middleware to handle CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'redirect-server' });
});

// Redirect all requests to the React app
app.get('/callback', (req, res) => {
  console.log('Received callback on port 8888');
  console.log('Request URL:', req.url);
  
  // Check query string for potential error
  if (req.query.error) {
    console.error('Spotify auth error:', req.query.error);
    return res.redirect('http://localhost:3000/?error=' + encodeURIComponent(req.query.error));
  }
  
  // Check for both hash and query parameters
  const hasQueryParams = Object.keys(req.query).length > 0;
  const hashPart = req.url.includes('#') ? req.url.substring(req.url.indexOf('#')) : '';
  
  // Determine the appropriate redirect URL
  let redirectUrl;
  
  if (hashPart) {
    // If we have a hash fragment (implicit grant flow)
    redirectUrl = `http://localhost:3000/callback${hashPart}`;
    console.log('Redirecting with hash to:', redirectUrl);
  } else if (hasQueryParams && req.query.code) {
    // If we have a code parameter (authorization code flow)
    redirectUrl = `http://localhost:3000/callback?code=${req.query.code}`;
    console.log('Redirecting with code to:', redirectUrl);
  } else {
    // Fallback if no auth data found
    console.log('No auth data found in URL, redirecting to home');
    redirectUrl = 'http://localhost:3000/';
  }
  
  res.redirect(redirectUrl);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Redirect server running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
});