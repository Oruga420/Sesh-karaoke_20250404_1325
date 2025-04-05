// Simple direct lyrics endpoint - guaranteed to work
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
  
  // Get the request parameters
  const title = req.query.title || 'Unknown Song';
  const artist = req.query.artist || 'Unknown Artist';
  
  console.log(`[direct-lyrics-test] Request for "${title}" by "${artist}"`);
  console.log(`[direct-lyrics-test] Query params:`, req.query);
  
  // Create simple lyrics
  const lyrics = {
    text: `${title}\nBy ${artist}\n\n` +
          `This is a test song with lyrics.\n` +
          `It's just a simple test\n` +
          `To make sure our lyrics system works\n\n` +
          `No need for API keys\n` +
          `Or complicated calls\n` +
          `Just some basic text\n` +
          `To show on screen while music plays\n\n` +
          `This is a direct fallback\n` +
          `To make our app more robust\n` +
          `So even when APIs fail\n` +
          `The karaoke still goes on`,
    
    synced: [
      { time: 0, words: [title] },
      { time: 3, words: ["By", artist] },
      { time: 6, words: ["This", "is", "a", "test", "song", "with", "lyrics."] },
      { time: 9, words: ["It's", "just", "a", "simple", "test"] },
      { time: 12, words: ["To", "make", "sure", "our", "lyrics", "system", "works"] },
      { time: 15, words: ["No", "need", "for", "API", "keys"] },
      { time: 18, words: ["Or", "complicated", "calls"] },
      { time: 21, words: ["Just", "some", "basic", "text"] },
      { time: 24, words: ["To", "show", "on", "screen", "while", "music", "plays"] },
      { time: 27, words: ["This", "is", "a", "direct", "fallback"] },
      { time: 30, words: ["To", "make", "our", "app", "more", "robust"] },
      { time: 33, words: ["So", "even", "when", "APIs", "fail"] },
      { time: 36, words: ["The", "karaoke", "still", "goes", "on"] }
    ],
    source: 'direct-test',
    debug: {
      apiUrl: req.headers.host || 'unknown',
      timestamp: new Date().toISOString(),
      query: { title, artist }
    }
  };
  
  // Return the lyrics
  return res.status(200).json({ lyrics });
};</parameter>
</invoke>