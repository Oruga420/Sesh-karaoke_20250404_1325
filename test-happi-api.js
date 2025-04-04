// Test script for Happi.dev API integration
const axios = require('axios');
require('dotenv').config();

const apiKey = process.env.HAPPI_API_KEY;

if (!apiKey) {
  console.error('ERROR: No HAPPI_API_KEY found in environment variables');
  console.log('Please set the HAPPI_API_KEY environment variable or create a .env file with this variable');
  process.exit(1);
}

console.log('HAPPI_API_KEY found in environment variables');

async function testHappiAPI() {
  try {
    console.log('Testing Happi.dev API connection...');
    
    // Test simple search
    const artist = 'The Weeknd';
    const title = 'Blinding Lights';
    
    console.log(`Searching for "${title}" by "${artist}"...`);
    
    const searchUrl = 'https://api.happi.dev/v1/music/search';
    const searchResponse = await axios.get(searchUrl, {
      params: {
        q: `${artist} ${title}`,
        limit: 1,
        apikey: apiKey
      },
      headers: {
        'x-happi-key': apiKey
      }
    });
    
    if (searchResponse.data.success && searchResponse.data.result && searchResponse.data.result.length > 0) {
      console.log('✓ Search successful!');
      console.log(`Found: "${searchResponse.data.result[0].track}" by "${searchResponse.data.result[0].artist}"`);
      
      // Test lyrics fetch
      const lyricsUrl = searchResponse.data.result[0].api_lyrics;
      console.log('Fetching lyrics...');
      
      const lyricsResponse = await axios.get(lyricsUrl, {
        headers: {
          'x-happi-key': apiKey
        }
      });
      
      if (lyricsResponse.data.success && lyricsResponse.data.result) {
        console.log('✓ Lyrics fetch successful!');
        
        // Show a snippet of the lyrics
        const lyricsText = lyricsResponse.data.result.lyrics;
        const lyricsPreview = lyricsText.split('\n').slice(0, 5).join('\n');
        
        console.log('\nLyrics preview:');
        console.log(lyricsPreview + '...');
        console.log('\nAPI test completed successfully! Your Happi.dev API key is working correctly.');
      } else {
        console.error('✗ Lyrics fetch failed:', lyricsResponse.data);
      }
    } else {
      console.error('✗ Search failed:', searchResponse.data);
    }
    
  } catch (error) {
    console.error('API test failed with error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testHappiAPI();