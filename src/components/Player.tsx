import React from 'react';
import { SpotifyTrack, clampProgress } from '../services/playbackPolling';
import { formatTime } from './Lyrics';
import './Player.css';

interface PlayerProps { track: (SpotifyTrack & { progress_ms: number }) | null; isPlaying?: boolean }

function Player({ track, isPlaying = false }: PlayerProps) {
  if (!track) return <div className="player player--empty">
    <div className="player__empty-content"><div className="player__empty-message">
      <p>No song is currently playing on Spotify</p>
      <p className="player__hint">Start a song in Spotify, or find lyrics below.</p>
    </div></div>
  </div>;
  const progress = clampProgress(track.progress_ms, track.duration_ms);
  const cover = track.album.images[0]?.url;
  return <div className="player" data-testid="spotify-player">
    <div className="player__album-container">
      <div className={`player__album-disc${isPlaying ? ' player__album-disc--playing' : ''}`}>
        {cover && <img src={cover} alt={`${track.album.name} album cover`} className="player__albumCover" />}
        <div className="player__album-center" />
      </div>
      <div className="player__mode">KARAOKE MODE</div>
    </div>
    <div className="player__info">
      <div className="player__track-info">
        <h2 className="player__title">{track.name}</h2>
        <p className="player__artist">{track.artists.map(artist => artist.name).join(', ')}</p>
        <p className="player__album-name">{track.album.name}</p>
      </div>
      <div className="player__progress-container">
        <div className="player__progress-bar"><div className="player__progress-fill" style={{ width: `${track.duration_ms > 0 ? progress / track.duration_ms * 100 : 0}%` }} /></div>
        <div className="player__time"><span>{formatTime(progress)}</span><span>{formatTime(track.duration_ms)}</span></div>
      </div>
    </div>
  </div>;
}
export default Player;
