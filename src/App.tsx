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
        // Check if this is the demo token
        if (savedToken === 'demo-mode-token') {
          console.log("Demo mode activated!");
          setToken(savedToken);
          // No need to set Spotify API token for demo mode
        } else {
          console.log("Found saved token:", savedToken.substring(0,10) + "...");
          setToken(savedToken);
          spotify.setAccessToken(savedToken);
          
          // Only verify online tokens
          if (navigator.onLine) {
            // Verify token is still valid
            spotify.getMe()
              .then(user => {
                console.log('User:', user);
              })
              .catch(error => {
                console.error('Token invalid:', error);
                
                // Don't remove token if we're offline, as we can't verify it
                if (navigator.onLine) {
                  localStorage.removeItem('spotify_token');
                  setToken(null);
                }
              });
          } else {
            console.log('Offline mode - skipping token verification');
          }
        }
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
        
        // Detect if this is an internet disconnection error
        const isOfflineError = 
          error.message?.includes('ERR_INTERNET_DISCONNECTED') || 
          error.message?.includes('NetworkError') ||
          error.code === 'ENOTFOUND';
        
        if (isOfflineError) {
          console.log('Internet appears to be disconnected - activating offline mode');
        }
        
        // Use demo track when offline or for testing
        const demoTrack: SpotifyTrack = {
          id: 'demo-track-123',
          name: 'Demo Song',
          uri: 'spotify:track:demo123',
          duration_ms: 180000,
          artists: [{
            id: 'demo-artist-123',
            name: 'Demo Artist',
            uri: 'spotify:artist:demo123'
          }],
          album: {
            id: 'demo-album-123',
            name: 'Demo Album',
            images: [{
              url: 'https://via.placeholder.com/300'
            }]
          }
        };
        
        // Handle offline mode by initializing the player with a demo track
        console.log('Using demo track for offline testing');
        setCurrentTrack(demoTrack);
        setIsPlaying(true);
        setTrackProgress(30000); // Start 30 seconds in
        
        // Generate demo lyrics for the demo track
        fetchLyrics('Demo Song', 'Demo Artist');
        
        // Simulate track progress for the demo
        if (progressInterval) {
          clearInterval(progressInterval);
        }
        
        lastUpdateTime = Date.now();
        progressInterval = setInterval(() => {
          setTrackProgress(prevProgress => {
            // Loop back to beginning when reaching end
            if (prevProgress >= 180000) {
              return 0;
            }
            return prevProgress + 100;
          });
        }, 100);
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
  }, [token, currentTrack]);
  
  // Fetch lyrics with improved debug logging
  const fetchLyrics = async (title: string, artist: string) => {
    try {
      console.log(`Fetching lyrics for ${title} by ${artist}`);
      
      // DIRECT APPROACH WITHOUT COMPLEX LOGIC
      // Call the API with minimal error handling
      const apiUrl = 'http://localhost:3001';
      console.log(`Direct API call to: ${apiUrl}/api/lyrics`);
      
      const response = await axios.get(`${apiUrl}/api/lyrics`, {
        params: { title, artist }
      });
      
      console.log(`API response status:`, response.status);
      console.log(`Raw response data:`, JSON.stringify(response.data).substring(0, 200) + '...');
      
      // Process the response data
      if (response.data && response.data.lyrics) {
        const lyricsData = response.data.lyrics;
        console.log(`Got lyrics from source: ${lyricsData.source}`);
        
        // Set the lyrics text
        setLyrics(lyricsData.text || '');
        
        // Convert synced lyrics to the format needed by the component
        if (lyricsData.synced && Array.isArray(lyricsData.synced)) {
          const formattedLyrics = lyricsData.synced.map((line: any) => {
            if (!line.words || !Array.isArray(line.words)) {
              return [];
            }
            
            // Map each word to the format needed by component
            return line.words.map((word: string) => ({
              word: word,
              timestamp: line.time
            }));
          });
          
          console.log(`Processed ${formattedLyrics.length} lines of synced lyrics`);
          setSyncedLyrics(formattedLyrics);
          setCurrentLine(0);
          setCurrentWord(0);
          return;
        }
      }
      
      throw new Error('Invalid response format or missing lyrics');
      
    } catch (error) {
      console.error('Error fetching lyrics:', error);
      
      // FALLBACK: Generate simple lyrics when API fails
      const fallbackLyrics = `Now playing: ${title}\nBy: ${artist}\n\nNo lyrics available\nEnjoy the music\n\nSynchronized lyrics\nWill appear here`;
      
      setLyrics(fallbackLyrics);
      
      // Create timed lyrics for fallback
      const lines = fallbackLyrics.split('\n');
      const syncedLines = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const words = line.split(' ');
        const formattedWords = words.map(word => ({
          word: word.trim(),
          timestamp: i * 3
        }));
        
        syncedLines.push(formattedWords);
      }
      
      setSyncedLyrics(syncedLines);
      setCurrentLine(0);
      setCurrentWord(0);
    }
  };
  
  // Improved lyrics synchronization logic with debounce to prevent flickering
  useEffect(() => {
    // Skip if we don't have required data
    if (!currentTrack || !syncedLyrics.length) return;
    
    // Set up interval for smoother updates (using interval instead of animation frame)
    let syncInterval: NodeJS.Timeout | null = null;
    let lastLineChange = 0; // Track when we last changed lines
    
    // Sync function that's called at a fixed interval
    const syncLyrics = () => {
      // Skip updating if we recently changed lines (debounce)
      const now = Date.now();
      if (now - lastLineChange < 300) { // 300ms debounce
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
      
      // Only update state if line changed
      if (nextLine !== currentLine) {
        setCurrentLine(nextLine);
        setCurrentWord(0); // Reset word index
        lastLineChange = now; // Update timestamp of last change
      }
    };
    
    // Use interval instead of animation frame for more stability
    syncInterval = setInterval(syncLyrics, 200); // Check every 200ms
    
    // When track changes, reset the highest line counter
    if (currentTrack.id) {
      highestLineRef.current = 0;
    }
    
    // Clean up function
    return () => {
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [currentTrack?.id, syncedLyrics, trackProgress, syncAdjustment, currentLine, currentWord]);
  
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