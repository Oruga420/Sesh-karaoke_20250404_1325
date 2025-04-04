module.exports = (req, res) => {
  // Enable CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Log activity for debugging
  console.log('Received Spotify callback on Vercel serverless function');
  console.log('Request URL:', req.url);
  console.log('Query parameters:', req.query);
  
  // Check query string for potential error
  if (req.query.error) {
    console.error('Spotify auth error:', req.query.error);
    return res.redirect('/?error=' + encodeURIComponent(req.query.error));
  }
  
  // Handle different authentication flows
  if (req.query.code) {
    // Authorization Code flow - this needs a server to exchange code for token
    console.log('Received authorization code:', req.query.code);
    
    // Since we're using Implicit Grant flow, we'll redirect to a special HTML page
    // that explains why this doesn't work and redirects to start over
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Authentication Issue</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #121212;
      color: #ffffff;
      text-align: center;
      margin: 0;
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .container {
      max-width: 600px;
      padding: 2rem;
      border-radius: 8px;
      background-color: #282828;
    }
    h1 {
      margin-top: 0;
      color: #1DB954;
    }
    .button {
      display: inline-block;
      background-color: #1DB954;
      color: white;
      padding: 12px 24px;
      border-radius: 50px;
      text-decoration: none;
      font-weight: bold;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Authentication Mode Issue</h1>
    <p>We received an authorization code instead of an access token.</p>
    <p>This app uses the Implicit Grant Flow which should return an access token directly.</p>
    <p>Please try again with the correct authorization flow.</p>
    <a href="/" class="button">Start Over</a>
  </div>
</body>
</html>`;
    return res.status(200).send(html);
  }
  
  // For Implicit Grant flow, create a page that extracts the token from the URL fragment
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Finalizing Authentication</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #121212;
      color: #ffffff;
      text-align: center;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
    }
    .container {
      max-width: 500px;
      padding: 2rem;
      border-radius: 8px;
      background-color: #282828;
    }
    h1 {
      margin-top: 0;
      color: #1DB954;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(29, 185, 84, 0.3);
      border-radius: 50%;
      border-top-color: #1DB954;
      margin: 2rem auto;
      animation: spin 1s ease-in-out infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    #debug {
      font-size: 12px;
      margin-top: 20px;
      text-align: left;
      background: #222;
      padding: 10px;
      border-radius: 4px;
      max-height: 150px;
      overflow: auto;
      display: none;
    }
    #debug.visible {
      display: block;
    }
    #toggle-debug {
      background: transparent;
      border: 1px solid #666;
      color: #888;
      padding: 5px 10px;
      border-radius: 4px;
      margin-top: 10px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Spotify Karaoke</h1>
    <p>Finalizing authentication...</p>
    <div class="spinner"></div>
    <p id="status-text">Looking for authorization data...</p>
    
    <button id="toggle-debug">Show Debug Info</button>
    <div id="debug"></div>
  </div>
  
  <script>
    // Handle the callback from Spotify OAuth
    (function() {
      const debugEl = document.getElementById('debug');
      const statusEl = document.getElementById('status-text');
      const toggleBtn = document.getElementById('toggle-debug');
      
      function log(msg) {
        console.log(msg);
        debugEl.innerHTML += msg + '<br>';
      }
      
      toggleBtn.addEventListener('click', function() {
        debugEl.classList.toggle('visible');
        this.textContent = debugEl.classList.contains('visible') ? 'Hide Debug Info' : 'Show Debug Info';
      });
      
      log('Callback handler running at: ' + new Date().toISOString());
      log('Current URL: ' + window.location.href);
      log('URL hash: ' + window.location.hash);
      log('Search params: ' + window.location.search);
      
      // Wrap everything in a try-catch to handle any errors
      try {
        // First check for hash fragment which contains the token in Implicit Grant flow
        if (window.location.hash) {
          statusEl.textContent = 'Access token found! Processing...';
          log('Hash fragment found, extracting token...');
          
          // Extract token from hash
          const hash = window.location.hash
            .substring(1)
            .split('&')
            .reduce(function(initial, item) {
              if (item) {
                const parts = item.split('=');
                initial[parts[0]] = decodeURIComponent(parts[1]);
              }
              return initial;
            }, {});
          
          log('Extracted data: ' + JSON.stringify(hash));
          
          if (hash.access_token) {
            statusEl.textContent = 'Authentication successful! Redirecting...';
            
            // Store the token
            localStorage.setItem('spotify_token', hash.access_token);
            log('Token stored in localStorage');
            
            // Store expiration if available
            if (hash.expires_in) {
              const expiresAt = Date.now() + parseInt(hash.expires_in) * 1000;
              localStorage.setItem('token_expiry', expiresAt.toString());
              log('Token expires: ' + new Date(expiresAt).toISOString());
            }
            
            // Redirect to the main app after a delay
            setTimeout(function() {
              log('Redirecting to home page...');
              window.location.href = '/';
            }, 1500);
          } else {
            statusEl.textContent = 'No token found in URL';
            log('ERROR: Hash exists but no access_token parameter found');
          }
        } else if (window.location.search && window.location.search.includes('code=')) {
          // We got authorization code flow - not what we want
          statusEl.textContent = 'Wrong auth flow (code instead of token)';
          log('WARNING: Received authorization code instead of token');
          log('This app uses Implicit Grant flow which provides token directly');
          
          // Show a retry button after a delay
          setTimeout(function() {
            statusEl.innerHTML = 'Please <a href="/" style="color:#1DB954;text-decoration:none;">click here</a> to try again';
          }, 2000);
        } else {
          // No authentication data found
          statusEl.textContent = 'No authentication data found';
          log('ERROR: No token or code found in URL');
          
          // Show a retry button after a delay
          setTimeout(function() {
            statusEl.innerHTML = 'Please <a href="/" style="color:#1DB954;text-decoration:none;">click here</a> to return to login';
          }, 2000);
        }
      } catch(e) {
        statusEl.textContent = 'Error processing authentication';
        log('ERROR: ' + e.message);
        log('Stack: ' + e.stack);
      }
    })();
  </script>
</body>
</html>`;

  // Send the HTML page
  return res.status(200).send(html);
};