module.exports = (req, res) => {
  console.log('Received callback on Vercel serverless function');
  console.log('Request URL:', req.url);
  
  // Check query string for potential error
  if (req.query.error) {
    console.error('Spotify auth error:', req.query.error);
    return res.redirect('/?error=' + encodeURIComponent(req.query.error));
  }
  
  // Check for both hash and query parameters
  const hasQueryParams = Object.keys(req.query).length > 0;
  const hashPart = req.url.includes('#') ? req.url.substring(req.url.indexOf('#')) : '';
  
  // Determine the appropriate redirect URL
  let redirectUrl;
  
  if (hashPart) {
    // If we have a hash fragment (implicit grant flow)
    redirectUrl = `/callback${hashPart}`;
    console.log('Redirecting with hash to:', redirectUrl);
  } else if (hasQueryParams && req.query.code) {
    // If we have a code parameter (authorization code flow)
    redirectUrl = `/callback?code=${req.query.code}`;
    console.log('Redirecting with code to:', redirectUrl);
  } else {
    // Fallback if no auth data found
    console.log('No auth data found in URL, redirecting to home');
    redirectUrl = '/';
  }
  
  res.redirect(redirectUrl);
};