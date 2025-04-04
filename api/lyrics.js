// Main lyrics API - directly uses Happi.dev
const happiHandler = require('./happi-lyrics');

module.exports = (req, res) => {
  console.log('[lyrics.js] Received lyrics request, forwarding to Happi.dev handler');
  return happiHandler(req, res);
};