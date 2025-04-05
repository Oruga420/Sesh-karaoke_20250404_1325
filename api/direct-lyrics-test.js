// Super simple direct lyrics endpoint
module.exports = (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Get the request parameters
  const title = req.query.title || 'Unknown Song';
  const artist = req.query.artist || 'Unknown Artist';
  
  // Create simple lyrics
  const lyrics = {
    text: `${title}\nBy ${artist}\n\nThis is a test song with lyrics.\nIt's just a simple test\nTo make sure our lyrics system works\n\nNo need for API keys\nOr complicated calls\nJust some basic text\nTo show on screen while music plays`,
    
    synced: [
      { time: 0, words: [title] },
      { time: 3, words: ["By", artist] },
      { time: 6, words: ["This", "is", "a", "test", "song", "with", "lyrics."] },
      { time: 9, words: ["It's", "just", "a", "simple", "test"] },
      { time: 12, words: ["To", "make", "sure", "our", "lyrics", "system", "works"] },
      { time: 15, words: ["No", "need", "for", "API", "keys"] },
      { time: 18, words: ["Or", "complicated", "calls"] },
      { time: 21, words: ["Just", "some", "basic", "text"] },
      { time: 24, words: ["To", "show", "on", "screen", "while", "music", "plays"] }
    ],
    source: 'direct-test'
  };
  
  // Return the lyrics
  return res.status(200).json({ lyrics });
};