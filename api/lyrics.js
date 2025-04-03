const { exec } = require('child_process');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Helper function to parse LRC format lyrics
function parseLRC(lrcText) {
  const lyrics = [];
  const plainText = [];
  
  for (const line of lrcText.split('\n')) {
    if (line.trim()) {
      // Extract timestamp and text
      if (line.startsWith('[') && line.includes(']')) {
        const timestampEnd = line.indexOf(']');
        const timestampStr = line.substring(1, timestampEnd);
        const text = line.substring(timestampEnd + 1).trim();
        
        // Skip metadata lines
        if (timestampStr.includes(':') && !timestampStr.startsWith('0')) {
          continue;
        }
        
        try {
          // Parse the timestamp (format: mm:ss.xx)
          let timeSeconds;
          if (timestampStr.includes(':')) {
            const [mins, secs] = timestampStr.split(':');
            timeSeconds = (parseFloat(mins) * 60) + parseFloat(secs);
          } else {
            timeSeconds = parseFloat(timestampStr);
          }
          
          // Only add lines with actual text
          if (text) {
            // Split into words
            const words = text.split(' ').filter(w => w.trim()).map(w => w.trim());
            lyrics.push({
              time: timeSeconds,
              words: words
            });
            plainText.push(text);
          }
        } catch (e) {
          console.error(`Error parsing timestamp ${timestampStr}:`, e);
        }
      }
    }
  }
  
  return {
    text: plainText.join('\n'),
    synced: lyrics,
    source: 'lrclib.net'
  };
}

// Helper function to generate sample lyrics when other sources fail
function generateSampleLyrics(title, artist) {
  // Create a clean version of title and artist
  const cleanTitle = title.replace(/\(.*?\)/g, '').trim();
  
  const lyrics = `The rhythm fills the air as music plays\n${artist} takes us on a journey through sound\nEvery beat and melody tells a story\nTime stands still when the music flows\n\nLet the ${cleanTitle} move through your body\nFeel every note as it touches your soul\n${artist} brings a unique energy\nThat only music can truly express`;
  
  const lines = lyrics.split('\n').filter(line => line.trim());
  const synced = [];
  let currentTime = 0;
  
  lines.forEach((line, index) => {
    const words = line.split(' ').filter(w => w.trim()).map(w => w.trim());
    if (words.length > 0) {
      synced.push({
        time: index * 3, // 3 seconds per line
        words: words
      });
    }
  });
  
  return {
    text: lyrics,
    synced: synced,
    source: 'generated'
  };
}

// Fetch lyrics from lrclib.net
async function fetchFromLrcLib(artist, title) {
  try {
    console.log(`[lrclib] Searching for: ${title} by ${artist}`);
    
    const params = new URLSearchParams({
      artist_name: artist,
      track_name: title,
      album_name: ''
    });
    
    const url = `https://lrclib.net/api/get?${params.toString()}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'SpotifyKaraoke/1.0'
      },
      validateStatus: status => status === 200 || status === 404,
      timeout: 5000 // 5 second timeout
    });
    
    if (response.status === 404) {
      console.log('[lrclib] No lyrics found');
      return null;
    }
    
    const data = response.data;
    
    if (data.syncedLyrics) {
      console.log('[lrclib] Found synced lyrics');
      return parseLRC(data.syncedLyrics);
    } else if (data.plainLyrics) {
      console.log('[lrclib] Found plain lyrics only');
      // Convert to pseudo-synchronized format
      const lines = data.plainLyrics.split('\n').filter(line => line.trim());
      const synced = [];
      
      lines.forEach((line, index) => {
        const words = line.split(' ')
          .filter(word => word.trim())
          .map(word => word.trim());
        
        if (words.length > 0) {
          synced.push({
            time: index * 3, // 3 seconds per line
            words: words
          });
        }
      });
      
      return {
        text: data.plainLyrics,
        synced: synced,
        source: 'lrclib.net'
      };
    }
    
    return null;
  } catch (error) {
    console.error('[lrclib] Error:', error.message);
    return null;
  }
}

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
    const { title, artist } = req.query;
    
    if (!title || !artist) {
      return res.status(400).json({ error: 'Title and artist are required' });
    }
    
    console.log(`[API] Requested lyrics for: "${title}" by "${artist}"`);
    
    // Try to fetch from lrclib.net first
    const lyricsData = await fetchFromLrcLib(artist, title);
    
    if (lyricsData && lyricsData.synced && lyricsData.synced.length > 0) {
      console.log(`[API] Returning lyrics from ${lyricsData.source} with ${lyricsData.synced.length} lines`);
      return res.status(200).json({ lyrics: lyricsData });
    }
    
    // If no lyrics found, generate sample lyrics
    console.log('[API] No lyrics found, generating sample');
    const sampleLyrics = generateSampleLyrics(title, artist);
    return res.status(200).json({ lyrics: sampleLyrics });
    
  } catch (error) {
    console.error('[API] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch lyrics',
      message: error.message 
    });
  }
};