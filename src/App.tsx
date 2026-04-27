import React, { useState, useEffect, useRef } from 'react';
import SpotifyWebApi from 'spotify-web-api-js';
import axios from 'axios';
import './App.css';
import Login from './components/Login';
import Player from './components/Player';
import Lyrics from './components/Lyrics';
import VisualizerView from './components/VisualizerView';
import SyncControls from './components/SyncControls';
import { exchangeCodeForToken } from './spotify';

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

  // Track which track id we're currently fetching/displaying lyrics for.
  // Used to discard stale lyrics responses when the user switches tracks fast.
  const activeTrackIdRef = useRef<string | null>(null);
  
  // Handle authentication: PKCE Authorization Code Flow.
  // The /callback route handles the code exchange; here we just pick up the
  // resulting token from localStorage. We also defensively handle ?code=...
  // landing on the root in case the redirect URI is misconfigured.
  useEffect(() => {
    const handleAuth = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const authError = url.searchParams.get('error');

      if (authError) {
        console.error('Spotify auth error in URL:', authError);
      }

      if (code) {
        try {
          const tokenRes = await exchangeCodeForToken(code);
          localStorage.setItem('spotify_token', tokenRes.access_token);
          const expiresAt = Date.now() + tokenRes.expires_in * 1000;
          localStorage.setItem('token_expiry', expiresAt.toString());
          if (tokenRes.refresh_token) {
            localStorage.setItem('spotify_refresh_token', tokenRes.refresh_token);
          }
          setToken(tokenRes.access_token);
          spotify.setAccessToken(tokenRes.access_token);
          window.history.replaceState({}, '', url.pathname);
          setLoading(false);
          return;
        } catch (e) {
          console.error('Token exchange failed on root:', e);
          // fall through to localStorage check
        }
      }

      const savedToken = localStorage.getItem('spotify_token');
      const savedExpiry = parseInt(localStorage.getItem('token_expiry') || '0', 10);
      if (savedToken && (!savedExpiry || Date.now() < savedExpiry)) {
        setToken(savedToken);
        spotify.setAccessToken(savedToken);
        spotify.getMe().catch((error: any) => {
          console.error('Token invalid:', error);
          localStorage.removeItem('spotify_token');
          localStorage.removeItem('token_expiry');
          setToken(null);
        });
      } else if (savedToken) {
        // Expired
        localStorage.removeItem('spotify_token');
        localStorage.removeItem('token_expiry');
      }

      setLoading(false);
    };

    handleAuth();
  }, []);
  
  // Get current playing track.
  // NOTE: deps are [token] only. Including currentTrack here causes the effect to
  // tear down and re-run on every poll, which resets lastTrackId and triggers a
  // fresh fetchLyrics call ~once per second (lrclib rate-limit risk).
  useEffect(() => {
    if (!token) return;

    // Latest values captured by the local-progress interval. Updated on every poll
    // so the closure doesn't read a stale snapshot from the moment the track started.
    let lastTrackId = '';
    let baseProgressMs = 0;
    let baseTimestamp = 0;
    let isPlayingNow = false;

    const progressInterval = setInterval(() => {
      if (isPlayingNow) {
        const elapsed = Date.now() - baseTimestamp;
        setTrackProgress(baseProgressMs + elapsed);
      }
    }, 100);

    const getCurrentTrack = () => {
      spotify.getMyCurrentPlayingTrack().then((response: any) => {
        if (response && response.item) {
          const currentTrackId = response.item.id;
          const isNewTrack = currentTrackId !== lastTrackId;

          setCurrentTrack(response.item as SpotifyTrack);
          setIsPlaying(response.is_playing || false);
          setTrackProgress(response.progress_ms || 0);

          // Refresh closure variables read by the local-progress interval
          baseProgressMs = response.progress_ms || 0;
          baseTimestamp = Date.now();
          isPlayingNow = !!response.is_playing;
          lastTrackId = currentTrackId;

          if (isNewTrack) {
            console.log('New track detected: ' + response.item.name);
            highestLineRef.current = 0;
            setCurrentLine(0);
            setCurrentWord(0);

            const artistName = response.item.artists && response.item.artists.length > 0
              ? response.item.artists[0].name
              : 'Unknown Artist';
            const albumName = response.item.album?.name || '';
            const durationMs = response.item.duration_ms || 0;

            // Mark this track as the active fetch target so older in-flight
            // responses are discarded when they resolve.
            activeTrackIdRef.current = currentTrackId;

            fetchLyrics(response.item.name, artistName, albumName, durationMs, currentTrackId);
          }
        } else {
          setIsPlaying(false);
          isPlayingNow = false;
        }
      }).catch(error => {
        console.error('Error getting current track:', error);
        setCurrentTrack(null);
        setIsPlaying(false);
        isPlayingNow = false;
      });
    };

    getCurrentTrack();
    const spotifyCheckInterval = setInterval(getCurrentTrack, 1000);

    return () => {
      clearInterval(spotifyCheckInterval);
      clearInterval(progressInterval);
    };
  }, [token]);
  
  // Fetch lyrics from API.
  // expectedTrackId guards against race conditions: if the user changes track while
  // an older request is still in flight, the late response is discarded.
  const fetchLyrics = async (
    title: string,
    artist: string,
    album: string = '',
    durationMs: number = 0,
    expectedTrackId: string = ''
  ) => {
    try {
      console.log(`Fetching lyrics for ${title} by ${artist} (album=${album}, duration=${durationMs}ms)`);

      const apiBaseUrl = process.env.REACT_APP_API_URL || window.location.origin;
      const params = new URLSearchParams({ title, artist });
      if (album) params.append('album', album);
      if (durationMs > 0) params.append('duration', String(durationMs));
      const apiUrl = `${apiBaseUrl}/api/lyrics?${params.toString()}`;

      console.log(`Making API request to: ${apiUrl}`);
      const response = await axios.get(apiUrl, { timeout: 10000 });

      // Discard if a newer track is now active
      if (expectedTrackId && activeTrackIdRef.current !== expectedTrackId) {
        console.log(`Discarding stale lyrics for "${title}" (active track changed)`);
        return;
      }

      if (response.data && response.data.lyrics) {
        const lyricsData = response.data.lyrics;
        console.log(`Got lyrics from API with ${lyricsData.synced?.length || 0} synced lines`);

        setLyrics(lyricsData.text);

        const formattedLyrics = lyricsData.synced.map((line: any) => {
          return line.words.map((word: string) => ({
            word: word,
            timestamp: line.time,
          }));
        });

        setSyncedLyrics(formattedLyrics);
        setCurrentLine(0);
        setCurrentWord(0);
        return;
      }
      throw new Error('Invalid API response format');
    } catch (error) {
      console.error('Error in lyrics handling:', error);

      // Don't overwrite newer track's lyrics with this stale failure either
      if (expectedTrackId && activeTrackIdRef.current !== expectedTrackId) {
        return;
      }

      const fallbackLyrics = `${title}\nBy ${artist}\n\nLyrics Unavailable`;
      setLyrics(fallbackLyrics);

      const syncedLines = [
        [{ word: title, timestamp: 0 }],
        [{ word: 'By', timestamp: 3 }, { word: artist, timestamp: 3 }],
        [{ word: 'Lyrics', timestamp: 6 }, { word: 'Unavailable', timestamp: 6 }],
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
              
              {/* Manual sync nudge — useful when audio output (Bluetooth/car) adds latency */}
              <SyncControls onSyncAdjust={setSyncAdjustment} />

              {/* Lyrics with synchronized highlighting (apply user offset) */}
              <Lyrics
                syncedLyrics={syncedLyrics}
                currentLine={currentLine}
                currentWord={currentWord}
                progress={trackProgress + syncAdjustment}
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