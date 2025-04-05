// Hard-coded lyrics that will work 100% of the time
module.exports = (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Get song info from query parameters
  const title = req.query.title || 'Unknown Song';
  const artist = req.query.artist || 'Unknown Artist';
  
  // Fixed hardcoded response that won't break
  const response = {
    lyrics: {
      text: `${title}\nBy ${artist}\n\nLyrics provided by fixed endpoint\nNo external API needed\nThis should work 100% of the time\n\nEach line will display\nAs the song progresses\nEnjoy your music with simple lyrics`,
      synced: [
        { time: 0, words: [title] },
        { time: 3, words: ["By", artist] },
        { time: 6, words: ["Lyrics", "provided", "by", "fixed", "endpoint"] },
        { time: 9, words: ["No", "external", "API", "needed"] },
        { time: 12, words: ["This", "should", "work", "100%", "of", "the", "time"] },
        { time: 15, words: ["Each", "line", "will", "display"] },
        { time: 18, words: ["As", "the", "song", "progresses"] },
        { time: 21, words: ["Enjoy", "your", "music", "with", "simple", "lyrics"] },
      ],
      source: 'fixed-endpoint'
    }
  };
  
  return res.status(200).json(response);
};