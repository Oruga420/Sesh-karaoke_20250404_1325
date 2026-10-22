import React, { useEffect, useRef, useState } from 'react';
import './App.css';
import Login from './components/Login';
import Player from './components/Player';
import VisualizerView from './components/VisualizerView';
import SyncControls from './components/SyncControls';
import ManualLyricsSearch from './components/ManualLyricsSearch';
import LyricsResultView from './components/LyricsResultView';
import { clearSpotifySession, exchangeCodeForToken, getValidAccessToken, spotifyRequest, storeSpotifyToken } from './spotify';
import { LyricsLookup, Recording, recordingKey } from './services/lyricsService';
import { clampProgress, PlaybackSnapshot, SpotifyTrack, startPlaybackPolling } from './services/playbackPolling';
import { useLyricsLookup } from './services/useLyricsLookup';

function recordingForTrack(track: SpotifyTrack): Recording {
  return { title: track.name, artist: track.artists[0]?.name || '', album: track.album.name,
    duration: track.duration_ms, trackId: track.id };
}

function App() {
  const [connected, setConnected] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trackProgress, setTrackProgress] = useState(0);
  const [syncAdjustment, setSyncAdjustment] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const lyrics = useLyricsLookup();
  const { load, clear } = lyrics;
  const selection = useRef<'manual' | 'spotify'>(lyrics.view.requested ? 'manual' : 'spotify');
  const clock = useRef({ progress: 0, duration: 0, receivedAt: 0, playing: false });
  const searchInput = useRef<HTMLInputElement>(null);
  const reader = useRef<HTMLDivElement>(null);
  const restoreSearchFocus = useRef(false);
  const hasLyrics = lyrics.view.phase === 'ready' && ['found', 'instrumental'].includes(lyrics.view.lookup?.lyrics.status || '');
  const reading = hasLyrics && !searchOpen;
  const wasReading = useRef(reading);

  useEffect(() => {
    if (!reading && restoreSearchFocus.current) {
      restoreSearchFocus.current = false;
      searchInput.current?.focus();
    } else if (reading && !wasReading.current) {
      reader.current?.focus({ preventScroll: true });
    }
    wasReading.current = reading;
  }, [reading]);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        if (code) {
          const token = await exchangeCodeForToken(code);
          if (!active) return;
          storeSpotifyToken(token);
          url.searchParams.delete('code'); url.searchParams.delete('state');
          window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        }
        const token = await getValidAccessToken();
        if (active) setConnected(!!token);
      } catch (error) {
        if (!active) return;
        const authRequired = (error as { authRequired?: boolean }).authRequired;
        setConnected(!authRequired);
        setConnectionMessage(authRequired ? 'Conecta Spotify de nuevo para seguir la reproducción.' : 'Spotify no está disponible por el momento. Reconectando…');
      } finally { if (active) setAuthLoading(false); }
    }
    void initialize();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!connected) return;
    let lastTrackKey = '';
    const stop = startPlaybackPolling({
      request: signal => spotifyRequest<PlaybackSnapshot>('/me/player/currently-playing', { signal }),
      onPlayback: playback => {
        setConnectionMessage('');
        const track = playback?.item;
        if (!track?.id || !track.name || !track.artists?.[0]?.name || !track.album || !Number.isFinite(track.duration_ms)) {
          lastTrackKey = '';
          clock.current = { progress: 0, duration: 0, receivedAt: Date.now(), playing: false };
          setCurrentTrack(null); setIsPlaying(false); setTrackProgress(0);
          if (selection.current === 'spotify') clear();
          return;
        }
        const requested = recordingForTrack(track);
        const nextKey = recordingKey(requested);
        const progress = clampProgress(playback?.progress_ms || 0, track.duration_ms);
        clock.current = { progress, duration: track.duration_ms, receivedAt: Date.now(), playing: !!playback?.is_playing };
        setCurrentTrack(track); setIsPlaying(!!playback?.is_playing); setTrackProgress(progress);
        if (lastTrackKey !== nextKey && selection.current === 'spotify') {
          setSyncAdjustment(0); void load(requested);
        }
        lastTrackKey = nextKey;
      },
      onError: error => {
        const details = error as { status?: number; retryAfter?: number; authRequired?: boolean };
        if (details.authRequired || details.status === 401) {
          clearSpotifySession(); setConnected(false); setCurrentTrack(null); setIsPlaying(false); setTrackProgress(0);
          clock.current.playing = false;
          if (selection.current === 'spotify') clear();
          setConnectionMessage('Conecta Spotify de nuevo para seguir la reproducción.');
        } else {
          setConnectionMessage(details.status === 429 ? `Spotify está ocupado. Reintentando en ${details.retryAfter || 5} s.` : 'Se interrumpió la conexión con Spotify. Reconectando…');
        }
      },
    });
    const progressTimer = setInterval(() => {
      const snapshot = clock.current;
      if (snapshot.playing) setTrackProgress(clampProgress(snapshot.progress + Date.now() - snapshot.receivedAt, snapshot.duration));
    }, 100);
    return () => { stop(); clearInterval(progressTimer); clock.current.playing = false; };
  }, [connected, load, clear]);

  function manualSearch(requested: Recording) {
    selection.current = 'manual'; setSyncAdjustment(0); setSearchOpen(false); void load(requested);
  }
  function imported(lookup: LyricsLookup) {
    selection.current = 'manual'; setSyncAdjustment(0); setSearchOpen(false); lyrics.imported(lookup);
  }
  function returnToSearch() {
    restoreSearchFocus.current = reading;
    setSearchOpen(true);
    setWide(false);
    if (!reading) searchInput.current?.focus();
  }
  const followsPlayback = selection.current === 'spotify' && currentTrack !== null;
  return <div className={`app${reading ? ' app--reading' : ''}${wide && reading ? ' app--wide' : ''}`}>
    <a className="skip-link" href="#song-search" onClick={event => { event.preventDefault(); returnToSearch(); }}>Ir al buscador</a>
    <main className="app__main">
      <header className="app__header">
        <div className="app__identity"><h1>Karaoke</h1><p>Letras para cantar</p></div>
        <span className="app__signature" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 7h16M4 12h11M4 17h16" /></svg>A tu ritmo</span>
      </header>
      <div className="app__workspace">
        <div id="song-search" className="app__search" hidden={reading}>
          <ManualLyricsSearch onSearch={manualSearch} initial={lyrics.view.requested} titleInputRef={searchInput} />
        </div>
        <div id="song-reader" className="app__reading" ref={reader} tabIndex={-1} role="region" aria-label="Lector de letras">
          <LyricsResultView view={lyrics.view} reading={reading} followsPlayback={followsPlayback}
            progress={followsPlayback ? trackProgress + syncAdjustment : 0}
            duration={followsPlayback ? currentTrack?.duration_ms || 0 : 0} paused={!followsPlayback || !isPlaying}
            onRetry={lyrics.retry} onImport={imported} onReturnToSearch={returnToSearch}
            wide={wide} onToggleWide={() => setWide(value => !value)}
            tools={followsPlayback && lyrics.view.lookup?.lyrics.timing === 'line' ? <SyncControls adjustment={syncAdjustment} onSyncAdjust={setSyncAdjustment} /> : undefined} />
        </div>
        <section className="app__spotify" aria-label="Conexión con Spotify">
          {connectionMessage && <p className="app__connection" role="status">{connectionMessage}</p>}
          {authLoading ? <p role="status">Comprobando conexión con Spotify…</p> : !connected ? <Login /> : <>
            <h2>En Spotify</h2>
            <Player track={currentTrack ? { ...currentTrack, progress_ms: trackProgress } : null} isPlaying={isPlaying} />
            <div className="app__spotify-actions">
              {currentTrack && selection.current === 'manual' && <button type="button" onClick={() => {
                selection.current = 'spotify'; setSyncAdjustment(0); setSearchOpen(false); void load(recordingForTrack(currentTrack));
              }}>Usar canción de Spotify</button>}
              <button type="button" onClick={() => {
                clearSpotifySession(); setConnected(false); setCurrentTrack(null); setIsPlaying(false); setTrackProgress(0);
                if (selection.current === 'spotify') clear();
              }}>Desconectar Spotify</button>
            </div>
            {currentTrack && <details className="app__visualizer"><summary>Visualizador decorativo</summary><VisualizerView isPlaying={isPlaying} /></details>}
          </>}
        </section>
      </div>
    </main>
  </div>;
}
export default App;
