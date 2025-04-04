// API Index - serves as a human-friendly directory of available endpoints
module.exports = (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Simple HTML response for human readers
  const htmlResponse = `<!DOCTYPE html>
<html>
<head>
  <title>Spotify Karaoke API</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    h1 { color: #1DB954; /* Spotify green */ }
    .endpoint { background: #f4f4f4; padding: 12px; border-radius: 4px; margin-bottom: 12px; }
    .method { display: inline-block; background: #1DB954; color: white; padding: 2px 6px; border-radius: 4px; font-size: 12px; margin-right: 8px; }
    a { color: #1DB954; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Spotify Karaoke API</h1>
  <p>Welcome to the Spotify Karaoke API. This is a directory of available endpoints:</p>
  
  <div class="endpoint">
    <span class="method">GET</span>
    <strong>/api/health</strong> - Health check endpoint
  </div>
  
  <div class="endpoint">
    <span class="method">GET</span>
    <strong>/api/debug</strong> - Debug information for troubleshooting
  </div>
  
  <div class="endpoint">
    <span class="method">GET</span>
    <strong>/api/direct-lyrics</strong> - Lyrics endpoint that always works (no external dependencies)
  </div>
  
  <div class="endpoint">
    <span class="method">GET</span>
    <strong>/api/lyrics</strong> - Main lyrics endpoint (may use external services)
  </div>
  
  <div class="endpoint">
    <span class="method">POST</span>
    <strong>/api/refresh-token</strong> - Refresh a Spotify access token
  </div>
  
  <div class="endpoint">
    <span class="method">GET</span>
    <strong>/api/callback</strong> - Spotify OAuth callback handler
  </div>
  
  <p>
    <a href="/" target="_blank">Return to App</a>
  </p>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(htmlResponse);
};