// Main lyrics API - optimized for Happi.dev
const happiHandler = require('./happi-lyrics');
const directLyricsHandler = require('./direct-lyrics');

module.exports = async (req, res) => {
  console.log('[lyrics.js] Received request, checking for Happi.dev API key');
  
  // Check if Happi.dev API key is available
  const hasHappiKey = !!process.env.HAPPI_API_KEY;
  
  if (hasHappiKey) {
    console.log('[lyrics.js] Happi.dev API key found, using Happi.dev API');
    return happiHandler(req, res);
  } else {
    console.log('[lyrics.js] No Happi.dev API key found, falling back to direct-lyrics');
    return directLyricsHandler(req, res);
  }
};