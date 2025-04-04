// Musixmatch API integration for reliable lyrics
const axios = require('axios');

// The Musixmatch API base URL
const MUSIXMATCH_API_BASE = 'https://api.musixmatch.com/ws/1.1';

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
    
    // Replace with your actual Musixmatch API key
    const apiKey = process.env.MUSIXMATCH_API_KEY;
    
    if (!apiKey) {
      console.error('Musixmatch API key is not set');
      // Fall back to direct lyrics if API key is not available
      const directLyricsHandler = require('./direct-lyrics');
      return directLyricsHandler(req, res);
    }
    
    console.log(`[musixmatch] Searching for: "${title}" by "${artist}"`);
    
    // Step 1: Search for track ID
    const searchResponse = await axios.get(`${MUSIXMATCH_API_BASE}/matcher.lyrics.get`, {
      params: {
        q_track: title,
        q_artist: artist,
        apikey: apiKey
      }
    });
    
    // Check if we found lyrics
    if (searchResponse.data.message.header.status_code !== 200 || 
        !searchResponse.data.message.body.lyrics) {
      console.log(`[musixmatch] No lyrics found, trying track search`);
      
      // Try searching for the track ID first
      const trackSearchResponse = await axios.get(`${MUSIXMATCH_API_BASE}/track.search`, {
        params: {
          q_track: title,
          q_artist: artist,
          page_size: 1,
          page: 1,
          s_track_rating: 'desc',
          apikey: apiKey
        }
      });
      
      if (trackSearchResponse.data.message.header.status_code !== 200 || 
          !trackSearchResponse.data.message.body.track_list || 
          trackSearchResponse.data.message.body.track_list.length === 0) {
        // No track found, fall back to direct lyrics
        console.log(`[musixmatch] No track found for "${title}" by "${artist}"`);
        const directLyricsHandler = require('./direct-lyrics');
        return directLyricsHandler(req, res);
      }
      
      const trackId = trackSearchResponse.data.message.body.track_list[0].track.track_id;
      
      // Now get the lyrics with the track ID
      const lyricsResponse = await axios.get(`${MUSIXMATCH_API_BASE}/track.lyrics.get`, {
        params: {
          track_id: trackId,
          apikey: apiKey
        }
      });
      
      if (lyricsResponse.data.message.header.status_code !== 200 || 
          !lyricsResponse.data.message.body.lyrics) {
        console.log(`[musixmatch] No lyrics found for track ID: ${trackId}`);
        const directLyricsHandler = require('./direct-lyrics');
        return directLyricsHandler(req, res);
      }
      
      const lyricsText = lyricsResponse.data.message.body.lyrics.lyrics_body;
      
      // Now check if we can get synced lyrics (if available)
      try {
        const syncedResponse = await axios.get(`${MUSIXMATCH_API_BASE}/track.subtitle.get`, {
          params: {
            track_id: trackId,
            apikey: apiKey
          }
        });
        
        if (syncedResponse.data.message.header.status_code === 200 && 
            syncedResponse.data.message.body.subtitle && 
            syncedResponse.data.message.body.subtitle.subtitle_body) {
          // We have synced lyrics, parse them and return
          const syncedLyricsText = syncedResponse.data.message.body.subtitle.subtitle_body;
          const parsedSyncedLyrics = parseSyncedLyrics(syncedLyricsText);
          
          return res.status(200).json({
            lyrics: {
              text: lyricsText,
              synced: parsedSyncedLyrics,
              source: 'musixmatch-synced'
            }
          });
        }
      } catch (syncedError) {
        console.error('[musixmatch] Error fetching synced lyrics:', syncedError);
      }
      
      // Return unsynced lyrics if we couldn't get synced ones
      return res.status(200).json({
        lyrics: {
          text: lyricsText,
          synced: createPseudoSyncedLyrics(lyricsText, title, artist),
          source: 'musixmatch-unsynced'
        }
      });
    }
    
    // Process the lyrics from the matcher API
    const lyricsText = searchResponse.data.message.body.lyrics.lyrics_body;
    
    return res.status(200).json({
      lyrics: {
        text: lyricsText,
        synced: createPseudoSyncedLyrics(lyricsText, title, artist),
        source: 'musixmatch-matcher'
      }
    });
  } catch (error) {
    console.error('[musixmatch] Error:', error);
    
    // Always fall back to direct lyrics on any error
    const directLyricsHandler = require('./direct-lyrics');
    return directLyricsHandler(req, res);
  }
};

// Function to parse LRC format synced lyrics
function parseSyncedLyrics(syncedLyricsText) {
  const result = [];
  const lines = syncedLyricsText.split('\n');
  
  for (const line of lines) {
    // LRC format: [mm:ss.xx]lyrics text
    const match = line.match(/\[(\d+):(\d+)\.(\d+)\](.*)/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const hundredths = parseInt(match[3], 10);
      const text = match[4].trim();
      
      if (text) {
        const timeInSeconds = minutes * 60 + seconds + (hundredths / 100);
        result.push({
          time: timeInSeconds,
          words: text.split(' ')
        });
      }
    }
  }
  
  return result;
}

// Create pseudo-synced lyrics from regular text
function createPseudoSyncedLyrics(lyricsText, title, artist) {
  // Clean up lyrics text and split into lines
  const lines = lyricsText
    .replace('******* This Lyrics is NOT for Commercial use *******', '')
    .split('\n')
    .filter(line => line.trim())
    .filter(line => !line.includes('(1409623420141)'));
  
  // Create a synced structure
  const synced = [];
  
  // Add title and artist as first lines
  synced.push({ 
    time: 0, 
    words: [title]
  });
  
  synced.push({
    time: 3,
    words: ["By", artist]
  });
  
  // Add each line with a timestamp (start at 6 seconds, 3 seconds per line)
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    
    const timeInSeconds = 6 + (index * 3);
    const words = line.split(' ').filter(w => w.trim());
    
    if (words.length > 0) {
      synced.push({
        time: timeInSeconds,
        words: words
      });
    }
  });
  
  return synced;
}