import React from 'react';
import './VisualizerView.css';

function VisualizerView({ isPlaying }: { isPlaying: boolean }) {
  return <div className="visualizer-container">
    <div className="playback-status"><span className={`playback-status__${isPlaying ? 'playing' : 'paused'}`}>
      <span className="playback-status__label">{isPlaying ? 'Now Playing' : 'Paused'}</span>
    </span></div>
    <div className={`visualizer${isPlaying ? ' visualizer--playing' : ''}`} aria-hidden="true">
      <div className="visualizer__bars">{Array.from({ length: 32 }, (_, index) => <span key={index} style={{ height: `${20 + (index * 17 % 65)}%`, animationDelay: `${index * -.13}s` }} />)}</div>
    </div>
  </div>;
}
export default VisualizerView;
