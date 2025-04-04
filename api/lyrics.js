// Main lyrics API - redirects to direct-lyrics for better reliability
const directLyricsHandler = require('./direct-lyrics');

module.exports = (req, res) => {
  console.log('[lyrics.js] Received request, redirecting to direct-lyrics for better reliability');
  
  // Simply forward the request to the direct-lyrics handler
  return directLyricsHandler(req, res);
};