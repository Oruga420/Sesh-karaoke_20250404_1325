import React, { useEffect, useRef } from 'react';
import { LyricsResult, SyncedLine } from '../services/lyricsService';
import { clampProgress } from '../services/playbackPolling';
import './Lyrics.css';

interface LyricsProps {
  result: LyricsResult;
  progress: number;
  duration: number;
  paused: boolean;
}

export function activeLineIndex(lines: SyncedLine[], progressMs: number): number {
  let low = 0;
  let high = lines.length - 1;
  let active = -1;
  const seconds = (Number.isFinite(progressMs) ? progressMs : 0) / 1000;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lines[mid].time <= seconds) { active = mid; low = mid + 1; } else { high = mid - 1; }
  }
  return active;
}

function Lyrics({ result, progress, duration, paused }: LyricsProps) {
  const active = result.timing === 'line' ? activeLineIndex(result.synced, progress) : -1;
  const activeElement = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!paused) activeElement.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [active, paused]);
  const clamped = clampProgress(progress, duration);
  return (
    <div className={`lyrics ${result.timing === 'line' ? 'lyrics--dynamic' : 'lyrics--plain'}`} aria-label="Lyrics">
      <div className="lyrics__container">
        {result.timing === 'line' ? result.synced.map((line, index) => (
          <div key={`${line.time}-${index}`} ref={index === active ? activeElement : undefined}
            className={`lyrics__line${index === active ? ' lyrics__line--active' : index < active ? ' lyrics__line--passed' : ''}`}
            aria-current={index === active ? 'true' : undefined} data-line-time={line.time}>
            {line.words.join(' ')}
          </div>
        )) : <div className="lyrics__plain" data-testid="plain-lyrics">{result.text}</div>}
      </div>
      {duration > 0 && <div className="lyrics__progress">
        <div className="lyrics__progress-text">{formatTime(clamped)} / {formatTime(duration)} · {paused ? 'Paused' : 'Playing'}</div>
        <div className="lyrics__progress-bar" role="progressbar" aria-label="Song progress" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={clamped}>
          <div className="lyrics__progress-fill" style={{ width: `${clamped / duration * 100}%` }} />
        </div>
      </div>}
    </div>
  );
}

export function formatTime(ms: number): string {
  const seconds = Math.floor(Math.max(0, Number.isFinite(ms) ? ms : 0) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
export default Lyrics;
