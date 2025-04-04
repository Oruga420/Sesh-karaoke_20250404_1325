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
        
        // Clear current track on error to show default UI
        setCurrentTrack(null);
        setIsPlaying(false);
        
        // Clear progress interval if it exists
        if (progressInterval) {
          clearInterval(progressInterval);
          progressInterval = null;
        }
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
  
  // Fetch lyrics from API
  const fetchLyrics = async (title: string, artist: string) => {
    try {
      console.log(`Fetching lyrics for ${title} by ${artist}`);
      
      // For real songs, try to get lyrics from the API
      console.log('Attempting to fetch lyrics from API...');
      
      // Determine API URL - use window location origin if nothing specified
      const apiBaseUrl = process.env.REACT_APP_API_URL || window.location.origin;
      const apiUrl = `${apiBaseUrl}/api/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`;
      
      console.log(`Making API request to: ${apiUrl}`);
      const response = await axios.get(apiUrl, { timeout: 10000 });
      
      console.log('API response:', response.data);
      
      if (response.data && response.data.lyrics) {
        const lyricsData = response.data.lyrics;
        console.log(`Got lyrics from API with ${lyricsData.synced?.length || 0} synced lines`);
        
        // Set the lyrics text
        setLyrics(lyricsData.text);
        
        // Format the synced lyrics for display
        const formattedLyrics = lyricsData.synced.map((line: any) => {
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
      } else {
        throw new Error('Invalid API response format');
      }
      
    } catch (error) {
      console.error('Error in lyrics handling:', error);
      
      // FALLBACK: Generate super simple lyrics if even the direct method fails
      const fallbackLyrics = `${title}\nBy ${artist}\n\nLyrics Unavailable`;
      
      setLyrics(fallbackLyrics);
      
      // Create minimal timed lyrics
      const syncedLines = [
        [{ word: title, timestamp: 0 }],
        [{ word: "By", timestamp: 3 }, { word: artist, timestamp: 3 }],
        [{ word: "Lyrics", timestamp: 6 }, { word: "Unavailable", timestamp: 6 }]
      ];
      
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