// API endpoint for debugging Spotify authentication issues
module.exports = (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Gather debug information
  const debugInfo = {
    timestamp: new Date().toISOString(),
    environment: {
      node_env: process.env.NODE_ENV || 'development',
      vercel: process.env.VERCEL === '1' ? true : false,
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      query: req.query
    },
    spotify: {
      clientIdConfigured: !!process.env.REACT_APP_SPOTIFY_CLIENT_ID,
      clientId: process.env.REACT_APP_SPOTIFY_CLIENT_ID ? 
                process.env.REACT_APP_SPOTIFY_CLIENT_ID.substring(0, 6) + '...' : 
                'not set',
      redirectUri: process.env.REACT_APP_REDIRECT_URI || 'dynamically determined'
    },
    endpoints: {
      login: '/api/login', // You could create this endpoint to handle login server-side
      callback: '/api/callback',
      debug: '/api/spotify-debug'
    },
    troubleshooting: {
      browser: [
        "Open browser console (F12) and check for errors",
        "Clear browser cache and cookies",
        "Try incognito/private browsing mode"
      ],
      spotify: [
        "Verify your Spotify Developer App settings",
        "Ensure redirect URI matches exactly what's in your Spotify Developer Dashboard",
        "Check that your app has the correct scopes"
      ],
      network: [
        "Ensure you're connected to the internet",
        "Check if Spotify API is accessible from your location"
      ]
    }
  };
  
  // Serve the debug information as HTML with styling
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Spotify Karaoke - Debug Info</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #121212;
      color: #ffffff;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      border-radius: 8px;
      background-color: #282828;
    }
    h1, h2, h3 {
      color: #1DB954;
    }
    pre {
      background-color: #1e1e1e;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
      white-space: pre-wrap;
    }
    .test-section {
      margin-top: 2rem;
      padding: 1rem;
      background-color: #333;
      border-radius: 4px;
    }
    .test-button {
      background-color: #1DB954;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 50px;
      cursor: pointer;
      font-weight: bold;
    }
    .url-field {
      width: 100%;
      padding: 8px;
      background-color: #1e1e1e;
      border: 1px solid #444;
      color: white;
      border-radius: 4px;
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Spotify Karaoke - Debug Information</h1>
    
    <h2>Environment</h2>
    <pre>${JSON.stringify(debugInfo.environment, null, 2)}</pre>
    
    <h2>Spotify Configuration</h2>
    <pre>${JSON.stringify(debugInfo.spotify, null, 2)}</pre>
    
    <h2>Request Details</h2>
    <pre>${JSON.stringify({
      method: debugInfo.request.method,
      url: debugInfo.request.url,
      query: debugInfo.request.query
    }, null, 2)}</pre>
    
    <h2>Client-Side Tests</h2>
    <div class="test-section">
      <h3>Generate Login URL</h3>
      <p>Click the button to generate a Spotify login URL based on your current configuration:</p>
      <button id="generate-url" class="test-button">Generate Login URL</button>
      <div id="url-result" style="margin-top: 1rem;"></div>
    </div>
    
    <div class="test-section">
      <h3>Check LocalStorage</h3>
      <p>Check if you have a Spotify token stored in localStorage:</p>
      <button id="check-storage" class="test-button">Check LocalStorage</button>
      <div id="storage-result" style="margin-top: 1rem;"></div>
    </div>
    
    <h2>Troubleshooting Tips</h2>
    <h3>Browser Issues</h3>
    <ul>
      ${debugInfo.troubleshooting.browser.map(tip => `<li>${tip}</li>`).join('')}
    </ul>
    
    <h3>Spotify Issues</h3>
    <ul>
      ${debugInfo.troubleshooting.spotify.map(tip => `<li>${tip}</li>`).join('')}
    </ul>
    
    <h3>Network Issues</h3>
    <ul>
      ${debugInfo.troubleshooting.network.map(tip => `<li>${tip}</li>`).join('')}
    </ul>
  </div>
  
  <script>
    // Generate Spotify login URL
    document.getElementById('generate-url').addEventListener('click', function() {
      // Use default client ID if not available in environment
      const clientId = "${debugInfo.spotify.clientId}" === "not set" 
        ? "3be3c1962cc44e2d820c6171d9debbf2"
        : "${debugInfo.spotify.clientId}";
        
      // Determine redirect URI
      let redirectUri;
      if ("${debugInfo.spotify.redirectUri}" !== "dynamically determined") {
        redirectUri = "${debugInfo.spotify.redirectUri}";
      } else {
        // Construct from current origin
        redirectUri = window.location.origin + "/callback";
      }
      
      // Define required scopes
      const scopes = [
        'user-read-currently-playing',
        'user-read-playback-state',
        'user-read-recently-played',
        'user-top-read',
      ].join('%20');
      
      // Construct the login URL
      const loginUrl = \`https://accounts.spotify.com/authorize?client_id=\${clientId}&redirect_uri=\${encodeURIComponent(redirectUri)}&scope=\${scopes}&response_type=token&show_dialog=true\`;
      
      // Display the result
      const resultEl = document.getElementById('url-result');
      resultEl.innerHTML = \`
        <p>Generated Login URL:</p>
        <input type="text" class="url-field" value="\${loginUrl}" readonly onclick="this.select();">
        <p>Redirect URI used: <code>\${redirectUri}</code></p>
        <p><a href="\${loginUrl}" style="color: #1DB954;">Click here to test this login URL</a></p>
      \`;
    });
    
    // Check local storage for Spotify token
    document.getElementById('check-storage').addEventListener('click', function() {
      const token = localStorage.getItem('spotify_token');
      const expiryStr = localStorage.getItem('token_expiry');
      
      const resultEl = document.getElementById('storage-result');
      
      if (token) {
        const tokenPreview = token.substring(0, 10) + '...';
        let expiryInfo = '';
        
        if (expiryStr) {
          const expiry = new Date(parseInt(expiryStr));
          const now = new Date();
          const isExpired = now > expiry;
          
          expiryInfo = \`
            <p>Token expires: <code>\${expiry.toLocaleString()}</code></p>
            <p>Status: <code>\${isExpired ? '❌ EXPIRED' : '✅ VALID'}</code></p>
          \`;
        }
        
        resultEl.innerHTML = \`
          <p>✅ Spotify token found in localStorage</p>
          <p>Token preview: <code>\${tokenPreview}</code></p>
          \${expiryInfo}
          <p><button class="test-button" id="clear-token">Clear Token</button></p>
        \`;
        
        document.getElementById('clear-token').addEventListener('click', function() {
          localStorage.removeItem('spotify_token');
          localStorage.removeItem('token_expiry');
          resultEl.innerHTML = '<p>✅ Token cleared successfully!</p>';
        });
      } else {
        resultEl.innerHTML = \`
          <p>❌ No Spotify token found in localStorage</p>
          <p>You need to log in with Spotify first.</p>
        \`;
      }
    });
  </script>
</body>
</html>`;
  
  // Return the HTML page
  res.status(200).send(html);
};