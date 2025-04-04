// Simplified lyrics API that will work on Vercel
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
  const { title = 'Unknown Song', artist = 'Unknown Artist' } = req.query;
  
  // Create basic lyrics
  const lyrics = {
    text: `${title}\nBy ${artist}\n\nLyrics are syncing with the beat\nEnjoy the music and follow along\nEach word appears as the song plays\nMusic brings us all together`,
    synced: [
      { time: 0, words: [title] },
      { time: 3, words: ["By", artist] },
      { time: 6, words: ["Lyrics", "are", "syncing", "with", "the", "beat"] },
      { time: 9, words: ["Enjoy", "the", "music", "and", "follow", "along"] },
      { time: 12, words: ["Each", "word", "appears", "as", "the", "song", "plays"] },
      { time: 15, words: ["Music", "brings", "us", "all", "together"] }
    ],
    source: 'direct'
  };
  
  // Return the lyrics
  return res.status(200).json({ lyrics });
};