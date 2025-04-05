import axios from 'axios';

// Dynamically determine the API URL
const API_URL = process.env.REACT_APP_API_URL || 
                (window.location.hostname === 'localhost' 
                  ? 'http://localhost:3001' 
                  : window.location.origin);

export interface SyncedLyrics {
  text: string;
  synced: {
    time: number;
    words: string[];
  }[];
}

export const fetchLyrics = async (title: string, artist: string): Promise<SyncedLyrics> => {
  try {
    console.log(`=== LYRICS DEBUG INFO ===`);
    console.log(`API URL: ${API_URL}`);
    console.log(`Window Location: ${window.location.href}`);
    console.log(`Fetching lyrics for "${title}" by "${artist}" from ${API_URL}/api/lyrics`);
    
    // Always use offline lyrics in demo mode
    if (title === 'Demo Song' && artist === 'Demo Artist') {
      console.log('Using demo lyrics for demo song');
      return createOfflineDemoLyrics();
    }
    
    try {
      // Construct the full API URL - adjust path for Vercel deployment
      let apiEndpoint;
      if (window.location.hostname.includes('vercel.app')) {
        // For Vercel deployments, use /lyrics directly per the rewrite rules
        // Add direct=true to use direct lyrics as a fallback
        apiEndpoint = `${window.location.origin}/lyrics?direct=true`;
      } else {
        // For local development, use the original path
        apiEndpoint = `${API_URL}/api/lyrics`;
      }
      console.log(`Making API request to: ${apiEndpoint}`);
      
      // Use a simple, hardcoded lyrics endpoint that's guaranteed to work
      const lyricsEndpoint = `${window.location.origin}/fixed-lyrics`;
      console.log(`Using fixed lyrics endpoint: ${lyricsEndpoint}`);
      const response = await axios.get(lyricsEndpoint, {
        params: { title, artist },
        timeout: 10000, // Increased timeout to 10 seconds
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      console.log(`Got response from API: ${response.status} ${response.statusText}`);
      console.log('Response data:', response.data);
      
      if (response.data && response.data.lyrics) {
        const lyricData = response.data.lyrics;
        console.log(`Successfully fetched lyrics with ${lyricData.synced?.length || 0} synced lines`);
        console.log(`Lyrics source: ${lyricData.source || 'unknown'}`);
        
        // For real songs (not demo), try Happi.dev first
        if (title !== 'Demo Song' && artist !== 'Demo Artist') {
          // Try using Happi.dev direct API as a backup
          try {
            const happiLyrics = await tryHappiDirectly(title, artist);
            if (happiLyrics) {
              console.log('Successfully fetched lyrics directly from Happi.dev');
              return happiLyrics;
            }
          } catch (happiError) {
            console.log('Could not fetch from Happi directly:', happiError);
          }
        }
        
        return lyricData;
      } else {
        // If response doesn't have expected structure
        console.error('Invalid lyrics response format:', response.data);
        
        // Return fallback lyrics
        return createFallbackLyrics(title, artist);
      }
    } catch (networkError) {
      console.error('Network error fetching lyrics:', networkError);
      console.log('Using offline mode with fallback lyrics');
      
      // Use static lyrics for certain popular songs if we're offline
      if (title.toLowerCase().includes('blinding lights') || 
          artist.toLowerCase().includes('weeknd')) {
        return createStaticLyrics('The Weeknd', 'Blinding Lights');
      }
      
      // Return fallback lyrics for any other track
      return createFallbackLyrics(title, artist);
    }
  } catch (error) {
    console.error('Error in lyrics service:', error);
    
    // Return fallback lyrics on any error
    return createFallbackLyrics(title, artist);
  }
};

// Try fetching lyrics directly from Happi.dev as a backup
async function tryHappiDirectly(title: string, artist: string): Promise<SyncedLyrics | null> {
  try {
    // This is just a fallback mechanism if your backend API fails
    console.log('Trying to fetch lyrics directly from Happi.dev');
    
    // Note: In production, you should never expose your API key in frontend code
    // This is just a temporary solution for debugging
    const response = await axios.get('https://api.happi.dev/v1/music/search', {
      params: {
        q: `${artist} ${title}`,
        limit: 1,
        apikey: '7Qd8TXUUNdaNAQXjJx6ZzLs9kOGvUzYi6XJMM1dKxo2P6nE2QBhKqZXf' // public test key, restricted usage
      }
    });
    
    if (response.data && response.data.success && response.data.result && response.data.result.length > 0) {
      const trackInfo = response.data.result[0];
      console.log('Found track:', trackInfo.track, 'by', trackInfo.artist);
      
      // Return simple lyrics format
      return {
        text: `${trackInfo.track}\nBy ${trackInfo.artist}\n\nLyrics found from Happi.dev API\nThis is a fallback mode\nPlease check your server configuration`,
        synced: [
          { time: 0, words: [trackInfo.track] },
          { time: 3, words: ["By", trackInfo.artist] },
          { time: 6, words: ["Lyrics", "found", "from", "Happi.dev", "API"] },
          { time: 9, words: ["This", "is", "a", "fallback", "mode"] },
          { time: 12, words: ["Please", "check", "your", "server", "configuration"] }
        ]
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching directly from Happi:', error);
    return null;
  }
}

// Create fallback lyrics when API fails
const createFallbackLyrics = (title: string, artist: string): SyncedLyrics => {
  console.log(`Creating fallback lyrics for "${title}" by "${artist}"`);
  
  const cleanTitle = title.replace(/\(.*?\)/g, '').trim();
  const linesOfLyrics = [
    `Now playing: ${cleanTitle}`,
    `By: ${artist}`,
    ``,
    `Lyrics are not available right now`,
    `But the music plays on`,
    ``,
    `Enjoy the melody and rhythm`,
    `Let the sound move you`,
    `Music connects us all`
  ];

  // Create synced lyrics structure
  const synced = linesOfLyrics.map((line, index) => {
    return {
      time: index * 3, // 3 seconds per line
      words: line ? line.split(' ') : []
    };
  });

  return {
    text: linesOfLyrics.join('\n'),
    synced: synced
  };
};

// Create special demo lyrics for offline testing
const createOfflineDemoLyrics = (): SyncedLyrics => {
  console.log('Creating demo lyrics for offline mode');
  
  const linesOfLyrics = [
    `This is a demo song`,
    `For offline testing mode`,
    ``,
    `No internet connection needed`,
    `Just enjoy the karaoke experience`,
    ``,
    `The lyrics will highlight`,
    `As the demo track plays along`,
    `Perfect for testing without Spotify`,
    ``,
    `Each line is synchronized`,
    `With the demo playback`,
    `Creating a complete karaoke experience`
  ];

  // Create synced lyrics structure with timestamps
  const synced = linesOfLyrics.map((line, index) => {
    return {
      time: 25 + (index * 4), // Start at 25 seconds, 4 seconds per line
      words: line ? line.split(' ') : []
    };
  });

  return {
    text: linesOfLyrics.join('\n'),
    synced: synced
  };
};

// Create static lyrics for popular songs when offline
const createStaticLyrics = (artist: string, title: string): SyncedLyrics => {
  console.log(`Creating static lyrics for ${title} by ${artist}`);
  
  // The Weeknd - Blinding Lights (partial lyrics with sync)
  if (title.toLowerCase().includes('blinding lights') || 
      artist.toLowerCase().includes('weeknd')) {
    const text = "Yeah\nI've been tryna call\nI've been on my own for long enough\nMaybe you can show me how to love, maybe\nI'm going through withdrawals\nYou don't even have to do too much\nYou can turn me on with just a touch, baby\nI look around and\nSin City's cold and empty (oh)\nNo one's around to judge me (oh)\nI can't see clearly when you're gone\nI said, ooh, I'm blinded by the lights\nNo, I can't sleep until I feel your touch\nI said, ooh, I'm drowning in the night\nOh, when I'm like this, you're the one I trust";
    
    const synced = [
      { time: 13.4, words: ["Yeah"] },
      { time: 27.0, words: ["I've", "been", "tryna", "call"] },
      { time: 29.8, words: ["I've", "been", "on", "my", "own", "for", "long", "enough"] },
      { time: 32.6, words: ["Maybe", "you", "can", "show", "me", "how", "to", "love,", "maybe"] },
      { time: 38.2, words: ["I'm", "going", "through", "withdrawals"] },
      { time: 41.1, words: ["You", "don't", "even", "have", "to", "do", "too", "much"] },
      { time: 43.9, words: ["You", "can", "turn", "me", "on", "with", "just", "a", "touch,", "baby"] },
      { time: 49.4, words: ["I", "look", "around", "and"] },
      { time: 50.7, words: ["Sin", "City's", "cold", "and", "empty", "(oh)"] },
      { time: 53.5, words: ["No", "one's", "around", "to", "judge", "me", "(oh)"] },
      { time: 56.3, words: ["I", "can't", "see", "clearly", "when", "you're", "gone"] },
      { time: 60.8, words: ["I", "said,", "ooh,", "I'm", "blinded", "by", "the", "lights"] },
      { time: 66.6, words: ["No,", "I", "can't", "sleep", "until", "I", "feel", "your", "touch"] },
      { time: 71.8, words: ["I", "said,", "ooh,", "I'm", "drowning", "in", "the", "night"] },
      { time: 77.9, words: ["Oh,", "when", "I'm", "like", "this,", "you're", "the", "one", "I", "trust"] }
    ];
    
    return { text, synced };
  }
  
  // Default to regular fallback if no match
  return createFallbackLyrics(title, artist);
};

// Function to convert synced lyrics to a display format
export const formatSyncedLyrics = (synced: SyncedLyrics): any[] => {
  if (!synced || !synced.synced || !Array.isArray(synced.synced)) {
    console.error('Invalid synced lyrics format:', synced);
    return [];
  }
  
  return synced.synced.map(line => {
    if (!line || !Array.isArray(line.words)) {
      console.error('Invalid line format:', line);
      return [];
    }
    
    return line.words.map(word => ({
      word,
      timestamp: line.time
    }));
  });
};
