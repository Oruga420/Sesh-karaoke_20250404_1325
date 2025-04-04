// Simplified direct lyrics API optimized as a fallback source
const popularSongs = require('./popular-songs.js');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,OPTIONS,PATCH,DELETE,POST,PUT'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Extract query parameters
    const { title, artist } = req.query;
    
    if (!title || !artist) {
      return res.status(400).json({ error: 'Title and artist are required' });
    }
    
    console.log(`[direct-lyrics] Request for: "${title}" by "${artist}"`);
    
    // Check if we have pre-defined lyrics for popular songs
    const popularLyrics = getPopularSongLyrics(title, artist);
    if (popularLyrics) {
      console.log(`[direct-lyrics] Found popular song lyrics for "${title}" by "${artist}"`);
      return res.status(200).json({ lyrics: popularLyrics });
    }
    
    // Generate sample lyrics as fallback
    const generatedLyrics = generateSampleLyrics(title, artist);
    return res.status(200).json({ lyrics: generatedLyrics });
  } catch (error) {
    console.error('[direct-lyrics] Error:', error);
    
    // Return emergency fallback lyrics that will always work
    const fallbackLyrics = {
      text: `${title || "Song"}\nBy ${artist || "Artist"}\n\nLyrics not available\nEnjoy the music\nAnd feel the rhythm`,
      synced: [
        { time: 0, words: [title || "Song"] },
        { time: 3, words: ["By", artist || "Artist"] },
        { time: 6, words: ["Lyrics", "not", "available"] },
        { time: 9, words: ["Enjoy", "the", "music"] },
        { time: 12, words: ["And", "feel", "the", "rhythm"] }
      ],
      source: 'fallback-lyrics'
    };
    
    return res.status(200).json({ lyrics: fallbackLyrics });
  }
};

// Function to find matching popular song lyrics
function getPopularSongLyrics(title, artist) {
  // Skip if popularSongs module is not available
  if (!popularSongs || !popularSongs.songs) {
    console.log('[direct-lyrics] Popular songs module not available');
    return null;
  }
  
  // Clean and normalize title and artist for matching
  const normalizedTitle = cleanString(title).toLowerCase();
  const normalizedArtist = cleanString(artist).toLowerCase();
  
  // Search for exact matches
  for (const song of popularSongs.songs) {
    const songTitle = cleanString(song.title).toLowerCase();
    const songArtist = cleanString(song.artist).toLowerCase();
    
    // Check for title and artist match
    if (songTitle.includes(normalizedTitle) && songArtist.includes(normalizedArtist)) {
      console.log(`[direct-lyrics] Found match for "${title}" by "${artist}"`);
      return song.lyrics;
    }
  }
  
  // Try matching just title for very popular songs
  for (const song of popularSongs.songs) {
    if (song.isPopular && cleanString(song.title).toLowerCase().includes(normalizedTitle)) {
      console.log(`[direct-lyrics] Found title-only match for "${title}"`);
      return song.lyrics;
    }
  }
  
  console.log(`[direct-lyrics] No match found for "${title}" by "${artist}"`);
  return null;
}

// Generate sample lyrics based on title and artist
function generateSampleLyrics(title, artist) {
  // Create a clean version of title and artist
  const cleanTitle = cleanString(title);
  const shortTitle = cleanTitle.split(' ').slice(0, 3).join(' '); // Use first 3 words max
  
  // Get song-specific template
  const lyricsTemplate = generateCustomTemplate(shortTitle, artist);
  
  // Split into lines and filter empty ones
  const lines = lyricsTemplate.split('\n').filter(line => line.trim());
  
  // Create synced lyrics structure with dynamic timing
  const synced = [];
  
  // Add title and artist as first lines
  synced.push({ 
    time: 0, 
    words: [cleanTitle]
  });
  
  synced.push({
    time: 3,
    words: ["By", artist]
  });
  
  // Add remaining lines with timing
  let currentTime = 6;
  lines.forEach((line) => {
    if (!line.trim()) return;
    
    const words = line.split(' ').filter(w => w.trim());
    if (words.length > 0) {
      synced.push({
        time: currentTime,
        words: words
      });
      
      // More time for longer lines
      currentTime += Math.max(2, Math.min(5, 1 + (words.length * 0.3)));
    }
  });
  
  return {
    text: lines.join('\n'),
    synced: synced,
    source: 'generated-lyrics'
  };
}

// Helper function to clean strings
function cleanString(str) {
  if (!str) return '';
  return str
    .replace(/\(.*?\)/g, '') // Remove content in parentheses
    .replace(/\[.*?\]/g, '') // Remove content in brackets
    .replace(/feat\..*$/i, '') // Remove "feat." and everything after
    .replace(/ft\..*$/i, '') // Remove "ft." and everything after
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();
}

// Generate a custom template based on the song
function generateCustomTemplate(title, artist) {
  // Create more interesting lyrics with placeholders
  return `
${title} fills the room with energy
${artist} creates a musical journey
Follow along with the melody
Let the rhythm guide you

Every beat tells a story
${artist} shares their vision through sound
The music speaks to our hearts
Time stands still when we listen

${title} reminds us why we love music
The perfect harmony of words and sound
Carried away by each note
This moment is just for you
`;
}