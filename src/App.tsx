import React, { useState, useEffect, useRef } from 'react';
import SpotifyWebApi from 'spotify-web-api-js';
import axios from 'axios';
import './App.css';
import Login from './components/Login';
import Player from './components/Player';
import Lyrics from './components/Lyrics';
import VisualizerView from './components/VisualizerView';
import SyncControls from './components/SyncControls';
import { getTokenFromUrl } from './spotify';

// Initialize Spotify Web API
const spotify = new SpotifyWebApi();

// Define interfaces for Spotify response objects
interface SpotifyImage {
  url: string;
  height?: number | null;
  width?: number | null;
}

interface SpotifyArtist {
  id: string;
  name: string;
  uri: string;
}

interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
}

interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
}

// Our own type for the synced lyrics
interface SyncedWord {
  word: string;
  timestamp: number;
}

function App() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);
  const [lyrics, setLyrics] = useState<string>('');
  const [syncedLyrics, setSyncedLyrics] = useState<SyncedWord[][]>([]);
  const [currentLine, setCurrentLine] = useState<number>(0);
  const [currentWord, setCurrentWord] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [trackProgress, setTrackProgress] = useState<number>(0);
  const [syncAdjustment, setSyncAdjustment] = useState<number>(0);
  
  // Store the highest line reached so far to prevent jumping back
  const highestLineRef = useRef<number>(0);
  
  // Handle authentication - FIXED VERSION
  useEffect(() => {
    // First check if token is in URL hash (redirected from Spotify)
    const hashParams = getTokenFromUrl();
    
    if (hashParams && hashParams.access_token) {
      const newToken = hashParams.access_token;
      console.log("Token found in URL:", newToken.substring(0,10) + "...");
      
      // Save token to localStorage
      localStorage.setItem("spotify_token", newToken);
      setToken(newToken);
      
      // Set this token in the Spotify API wrapper
      spotify.setAccessToken(newToken);
      
      // Clean the URL
      window.location.hash = "";
    } else {
      // Check for token in localStorage (for returning users)
      const savedToken = localStorage.getItem('spotify_token');
      if (savedToken) {
        console.log("Found saved token:", savedToken.substring(0,10) + "...");
        setToken(savedToken);
        spotify.setAccessToken(savedToken);
        
        // Verify token is still valid
        spotify.getMe()
          .then(user => {
            console.log('User:', user);
          })
          .catch(error => {
            console.error('Token invalid:', error);
            localStorage.removeItem('spotify_token');
            setToken(null);
          });
      }
    }
    
    setLoading(false);
  }, []);
  
  // Get current playing track
  useEffect(() => {
    if (!token) return;
    
    let lastTrackId = '';
    let progressInterval: NodeJS.Timeout | null = null;
    let lastUpdateTime = 0;
    
    const getCurrentTrack = () => {
      spotify.getMyCurrentPlayingTrack().then((response: any) => {
        if (response && response.item) {
          // Check if this is a new track
          const currentTrackId = response.item.id;
          const isNewTrack = currentTrackId !== lastTrackId;
          
          // Update current track info
          setCurrentTrack(response.item as SpotifyTrack);
          setIsPlaying(response.is_playing || false);
          setTrackProgress(response.progress_ms || 0);
          
          // Update last track ID and fetch time
          lastTrackId = currentTrackId;
          lastUpdateTime = Date.now();
          
          // If this is a new track, fetch lyrics and reset lyric position
          if (isNewTrack) {
            console.log('New track detected: ' + response.item.name);
            // Reset the highest line reference for the new track
            highestLineRef.current = 0;
            setCurrentLine(0);
            setCurrentWord(0);
            
            // Get the first artist's name
            const artistName = response.item.artists && response.item.artists.length > 0 
              ? response.item.artists[0].name 
              : 'Unknown Artist';
              
            fetchLyrics(response.item.name, artistName);
            
            // Clear previous interval if it exists
            if (progressInterval) {
              clearInterval(progressInterval);
            }
            
            // Set up a more frequent local progress tracking for smoother updates
            progressInterval = setInterval(() => {
              if (response.is_playing) {
                const elapsed = Date.now() - lastUpdateTime;
                const currentProgress = response.progress_ms || 0; // Handle null case
                const estimatedProgress = currentProgress + elapsed;
                setTrackProgress(estimatedProgress);
              }
            }, 100);
          }
        } else {
          // No track is playing
          setIsPlaying(false);
          
          // Clear progress interval if it exists
          if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
          }
        }
      }).catch(error => {
        console.error('Error getting current track:', error);
      });
    };
    
    // Initial check
    getCurrentTrack();
    
    // Update from Spotify API every second
    const spotifyCheckInterval = setInterval(getCurrentTrack, 1000);
    
    // Cleanup
    return () => {
      clearInterval(spotifyCheckInterval);
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    };
  }, [token]);
  
  // Fetch lyrics with improved debug logging
  const fetchLyrics = async (title: string, artist: string) => {
    try {
      console.log(`Fetching lyrics for ${title} by ${artist}`);
      
      // Add extra debug info to help diagnose issues
      console.log(`Track info - title: "${title}", artist: "${artist}"`);
      
      // Call our backend API to get lyrics
      // In production, use relative URL to avoid CORS issues
      let apiUrl;
      if (process.env.NODE_ENV === 'production') {
        apiUrl = '/api';
      } else {
        apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      }
      
      const requestUrl = `${apiUrl}/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`;
      console.log(`Making API call to: ${requestUrl}`);
      
      // Add timestamps to track response time
      const startTime = Date.now();
      
      const response = await axios.get(`${apiUrl}/lyrics`, {
        params: { title, artist },
        timeout: 15000 // 15 second timeout to prevent forever waiting
      });
      
      const endTime = Date.now();
      console.log(`API response received in ${endTime - startTime}ms:`, response.data);
      
      // Log response status and headers for debugging
      console.log(`Response status: ${response.status}`);
      console.log(`Response headers:`, response.headers);

      // Check if we got a valid response with lyrics
      if (response.data && response.data.lyrics) {
        const lyricsData = response.data.lyrics;
        
        // Add extra validation and debugging for the lyrics content
        console.log('Lyrics source:', lyricsData.source);
        console.log('Has synced lyrics:', Boolean(lyricsData.synced));
        console.log('Synced lyrics count:', lyricsData.synced?.length || 0);
        console.log('Has text:', Boolean(lyricsData.text));
        console.log('Text length:', lyricsData.text?.length || 0);
        
        // Set the raw lyrics text
        setLyrics(lyricsData.text || '');
        
        // Output first few lines of lyrics text for debugging
        if (lyricsData.text) {
          const firstLines = lyricsData.text.split('\n').slice(0, 3).join('\n');
          console.log('First few lines of lyrics text:', firstLines);
        }
        
        console.log('Full lyrics data:', JSON.stringify(lyricsData, null, 2));
        
        // Check if we have LRC formatted data
        if (lyricsData.lrcObject && lyricsData.lrcObject.lyrics && Array.isArray(lyricsData.lrcObject.lyrics)) {
          console.log(`Found LRC object with ${lyricsData.lrcObject.lyrics.length} lines`);
          
          // Process the LRC lyrics which have more precise timing
          const formattedLyrics = lyricsData.lrcObject.lyrics.map((lyric: any, lineIndex: number) => {
            // Get the content and timestamp
            const content = lyric.content || '';
            const timestamp = lyric.timestamp / 1000; // Convert ms to seconds
            
            // Split the content into words
            const words = content.split(' ')
              .filter((w: string) => w.trim())
              .map((w: string) => w.trim());
              
            // Format each word with the line's timestamp
            // This creates a properly timed word array for each line
            const formattedWords = words.map((word: string, wordIndex: number) => {
              // Calculate estimated time for this word within the line
              const wordTime = timestamp + (wordIndex * 0.3); // Approx 300ms per word
              
              return {
                word: word,
                timestamp: timestamp, // Each word has the line's timestamp for sync
                // We use the line timestamp instead of per-word time for better stability
                estimatedTime: wordTime // Store estimated time for potential future use
              };
            });
            
            if (lineIndex < 2) { // Only log first few lines to avoid console spam
              console.log(`LRC Line ${lineIndex} at ${timestamp}s: ${content}`);
            }
            
            return formattedWords;
          });
          
          console.log(`Processed ${formattedLyrics.length} LRC lines`);
          setSyncedLyrics(formattedLyrics);
        }
        // Fall back to standard synced lyrics if LRC is not available
        else if (lyricsData.synced && Array.isArray(lyricsData.synced)) {
          console.log(`Found ${lyricsData.synced.length} synced lines`);
          
          // Create properly formatted word objects for this line
          const formattedLyrics = lyricsData.synced.map((line: {time: number, words: string[]}, lineIndex: number) => {
            // Ensure each word is properly separated and trimmed
            if (!line.words || !Array.isArray(line.words)) {
              console.warn('Invalid words array in line:', line);
              return [];
            }
            
            // Create properly formatted word objects for this line
            const formattedWords = line.words.map((word: string, wordIndex: number) => {
              // Ensure the word is a string and trimmed
              const wordText = typeof word === 'string' ? word.trim() : String(word).trim();
              
              // Only log a few words to avoid console spam
              if (lineIndex < 2 && wordIndex < 3) {
                console.log(`Processing word: "${wordText}" at line ${lineIndex}`);
              }
              
              // Calculate estimated time for each word (more precise)
              const estimatedTime = line.time + (wordIndex * 0.3); // ~300ms per word
              
              return {
                word: wordText,
                timestamp: line.time, // Use line timestamp for stability
                estimatedTime: estimatedTime // Store for potential future use
              };
            });
            
            if (lineIndex < 2) { // Only log first few lines
              console.log(`Line ${lineIndex} formatted at ${line.time}s with ${formattedWords.length} words`);
            }
            
            return formattedWords;
          });
          
          console.log('Formatted lyrics:', formattedLyrics);
          setSyncedLyrics(formattedLyrics);
          
          // Reset current position
          setCurrentLine(0);
          setCurrentWord(0);
        } else {
          console.warn('No synced lyrics data received');
          setSyncedLyrics([]);
        }
      } else {
        console.error('Invalid response structure or no lyrics found:', response.data);
        // Clear any existing lyrics and show empty state
        setLyrics('');
        setSyncedLyrics([]);
      }
    } catch (error) {
      console.error('Error fetching lyrics:', error);
      console.error('Details:', error instanceof Error ? error.message : 'Unknown error');
      
      // Clear the lyrics and show the empty state instead of using fallback
      setLyrics('');
      setSyncedLyrics([]);
      setCurrentLine(0);
      setCurrentWord(0);
      
      // If it's an HTTP error with status, handle it specifically
      if (axios.isAxiosError(error) && error.response) {
        if (error.response.status === 404) {
          console.log('No lyrics found for this song');
        } else {
          console.log(`Server error: ${error.response.status}`);
        }
      }
    }
  };
  
  // Very simple lyrics synchronization logic
  useEffect(() => {
    // Skip if we don't have required data
    if (!currentTrack || !syncedLyrics.length || !isPlaying) return;
    
    // Set up animation frame for smoother updates
    let animationFrameId: number | undefined;
    
    // Sync function that's called on each animation frame
    const syncLyrics = () => {
      // Skip if playback is paused
      if (!isPlaying) {
        animationFrameId = requestAnimationFrame(syncLyrics);
        return;
      }
      
      // Calculate adjusted progress in seconds
      const progressInSeconds = (trackProgress + syncAdjustment) / 1000;
      
      // Check if we should advance to the next line 
      let nextLine = currentLine;
      const hasNextLine = currentLine + 1 < syncedLyrics.length;
      
      if (hasNextLine) {
        // Get the timestamp for the next line
        const nextLineTimestamp = syncedLyrics[currentLine + 1][0]?.timestamp || Number.MAX_VALUE;
        
        // If we've passed the next line's timestamp, advance to it
        if (progressInSeconds >= nextLineTimestamp) {
          nextLine = currentLine + 1;
        }
      }
      
      // IMPORTANT: Never go backwards in lyrics (prevents jumping back)
      if (nextLine > highestLineRef.current) {
        highestLineRef.current = nextLine;
      } else if (nextLine < highestLineRef.current) {
        // If the algorithm tries to go back, stay at our furthest point
        nextLine = highestLineRef.current;
      }
      
      // Simplify to highlight entire lines instead of individual words
      let nextWord = 0;
      
      if (syncedLyrics[nextLine] && syncedLyrics[nextLine].length > 0) {
        // Set word index to 0 - we'll highlight the entire line
        nextWord = 0;
        
        // If we already calculated the line properly, we don't need
        // to do word-level calculations for timing
      }
      
      // Only update state if something changed
      if (nextLine !== currentLine) {
        setCurrentLine(nextLine);
        setCurrentWord(nextWord);
      } else if (nextWord !== currentWord) {
        setCurrentWord(nextWord);
      }
      
      // Continue the animation loop
      animationFrameId = requestAnimationFrame(syncLyrics);
    };
    
    // Start the sync loop
    animationFrameId = requestAnimationFrame(syncLyrics);
    
    // When track changes, reset the highest line counter
    if (currentTrack.id) {
      highestLineRef.current = 0;
    }
    
    // Clean up function
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [currentTrack?.id, isPlaying, syncedLyrics, trackProgress, syncAdjustment, currentLine, currentWord]);
  
  // Display loading state
  if (loading) {
    return (
      <div className="app">
        <div className="app__container">
          <h2>Loading Spotify Karaoke...</h2>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="app">
      {!token ? (
        <Login />
      ) : (
        <div className="app__main">
          {/* Player with track information */}
          <Player 
            track={{
              ...currentTrack,
              progress_ms: trackProgress
            }} 
          />
          
          {currentTrack && (
            <>
              {/* Visualizer for the waveform and playback status */}
              <VisualizerView 
                isPlaying={isPlaying} 
                trackProgress={trackProgress}
              />
              
              {/* Lyrics with synchronized highlighting */}
              <Lyrics 
                syncedLyrics={syncedLyrics} 
                currentLine={currentLine}
                currentWord={currentWord}
                progress={trackProgress}
                duration={currentTrack?.duration_ms || 0}
                paused={!isPlaying}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default App;