import React from 'react';
import { SpotifyTrack, clampProgress } from '../services/playbackPolling';
import { formatTime } from './Lyrics';
import './Player.css';

interface PlayerProps { track: (SpotifyTrack & { progress_ms: number }) | null; isPlaying?: boolean }

function Player({ track, isPlaying = false }: PlayerProps) {
  if (!track) return <div className="player player--empty">
    <p>No hay ninguna canción sonando en Spotify.</p>
    <p className="player__hint">Abre una canción en Spotify o busca sus letras por título y artista.</p>
  </div>;
  const progress = clampProgress(track.progress_ms, track.duration_ms);
  const cover = track.album.images?.[0]?.url;
  return <div className="player" data-testid="spotify-player">
    {cover && <img src={cover} alt={`Portada de ${track.album.name}`} className="player__albumCover" />}
    <div className="player__info">
      <div className="player__track-info">
        <h3 className="player__title">{track.name}</h3>
        <p className="player__artist">{track.artists.map(artist => artist.name).join(', ')}</p>
        <p className="player__album-name">{track.album.name}</p>
      </div>
      <div className="player__progress-container">
        <div className="player__progress-bar" role="progressbar" aria-label="Progreso de Spotify" aria-valuemin={0} aria-valuemax={track.duration_ms || 1} aria-valuenow={progress}><div className="player__progress-fill" style={{ width: `${track.duration_ms > 0 ? progress / track.duration_ms * 100 : 0}%` }} /></div>
        <div className="player__time"><span>{formatTime(progress)}</span><span>{formatTime(track.duration_ms)}</span></div>
        <p className="player__hint">{isPlaying ? 'Reproduciendo en Spotify' : 'En pausa en Spotify'}</p>
      </div>
    </div>
  </div>;
}
export default Player;
