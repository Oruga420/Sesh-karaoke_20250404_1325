import React, { useEffect, useState } from 'react';
import './Player.css';

interface PlayerProps {
  track: any;
}

function Player({ track }: PlayerProps) {
  const [albumRotation, setAlbumRotation] = useState<number>(0);
  
  // Rotate the album image when playing
  useEffect(() => {
    if (!track) return;
    
    const rotateInterval = setInterval(() => {
      setAlbumRotation(prev => (prev + 0.2) % 360);
    }, 50);
    
    return () => clearInterval(rotateInterval);
  }, [track]);
  
  if (!track) {
    return (
      <div className="player player--empty">
        <div className="player__empty-content">
          <div className="player__icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#1DB954" strokeWidth="2"/>
              <path d="M9 8.5V15.5L16 12L9 8.5Z" fill="#1DB954"/>
            </svg>
          </div>
          <div className="player__empty-message">
            <p>No song is currently playing on Spotify</p>
            <p className="player__hint">Start playing a song on Spotify to see lyrics</p>
          </div>
        </div>
      </div>
    );
  }

  // Format artist names
  const artistNames = track.artists?.map((artist: any) => artist.name).join(', ');
  
  // Get the largest album image
  const albumImage = track.album?.images?.length > 0 
    ? track.album.images[0].url 
    : 'https://via.placeholder.com/300';

  return (
    <div className="player">
      <div className="player__album-container">
        <div 
          className="player__album-disc"
          style={{ transform: `rotate(${albumRotation}deg)` }}
        >
          <img 
            src={albumImage}
            alt={track.album?.name}
            className="player__albumCover"
          />
          <div className="player__album-center"></div>
        </div>
        <div className="player__mode">KARAOKE MODE</div>
      </div>
      
      <div className="player__info">
        <div className="player__track-info">
          <h1 className="player__title">{track.name}</h1>
          <p className="player__artist">{artistNames}</p>
          {track.album?.name && (
            <p className="player__album-name">{track.album.name}</p>
          )}
        </div>
        
        <div className="player__controls">
          <div className="player__progress-container">
            <div className="player__progress-bar">
              <div 
                className="player__progress-fill" 
                style={{ 
                  width: track.duration_ms ? `${Math.min(100, (track.progress_ms || 0) / track.duration_ms * 100)}%` : '0%'
                }}
              ></div>
            </div>
            <div className="player__time">
              <span className="player__time-passed">
                {formatTime(track.progress_ms || 0)}
              </span>
              <span className="player__time-duration">
                {formatTime(track.duration_ms || 0)}
              </span>
            </div>
          </div>
          
          <p className="player__instructions">
            <span className="player__instructions-icon">🎤</span> Sing along with the highlighted lyrics below!
          </p>
        </div>
      </div>
    </div>
  );
}

// Helper function to format time in MM:SS
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default Player;