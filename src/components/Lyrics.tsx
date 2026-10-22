import React, { useEffect, useRef, useState } from 'react';
import { LyricsResult, SyncedLine } from '../services/lyricsService';
import { clampProgress } from '../services/playbackPolling';
import './Lyrics.css';

interface LyricsProps {
  result: LyricsResult;
  progress: number;
  duration: number;
  paused: boolean;
  followsPlayback?: boolean;
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

function Lyrics({ result, progress, duration, paused, followsPlayback = duration > 0 }: LyricsProps) {
  const [readingSize, setReadingSize] = useState('normal');
  const [manualLine, setManualLine] = useState(0);
  const [autoFollow, setAutoFollow] = useState(true);
  const hasLineTimings = result.timing === 'line';
  const isTimedPlayback = hasLineTimings && followsPlayback;
  const active = hasLineTimings ? isTimedPlayback ? activeLineIndex(result.synced, progress)
    : Math.min(manualLine, result.synced.length - 1) : -1;
  const containerElement = useRef<HTMLDivElement>(null);
  const activeElement = useRef<HTMLDivElement>(null);

  useEffect(() => { setManualLine(0); setAutoFollow(true); }, [result]);
  useEffect(() => {
    if (isTimedPlayback && (paused || !autoFollow)) return;
    const container = containerElement.current;
    const line = activeElement.current;
    if (!container || !line || container.clientHeight === 0) return;
    const bounds = container.getBoundingClientRect();
    const lineBounds = line.getBoundingClientRect();
    const top = lineBounds.top - bounds.top;
    if (top >= 0 && lineBounds.bottom - bounds.top <= container.clientHeight) return;
    const target = Math.max(0, container.scrollTop + top - Math.max(0, (container.clientHeight - lineBounds.height) / 2));
    const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    // Move this scroll region only; scrollIntoView can also move the surrounding page.
    if (typeof container.scrollTo === 'function') container.scrollTo({ top: target, behavior });
    else container.scrollTop = target;
  }, [active, autoFollow, isTimedPlayback, paused, readingSize, result]);

  const readFreely = () => { if (isTimedPlayback) setAutoFollow(false); };
  const clamped = clampProgress(progress, duration);
  const showProgress = followsPlayback && Number.isFinite(duration) && duration > 0;
  return (
    <div className={`lyrics ${hasLineTimings ? 'lyrics--dynamic' : 'lyrics--plain'} lyrics--${readingSize}`} aria-label="Letra de la canción">
      {hasLineTimings && <div className="lyrics__position">
        <span>{isTimedPlayback ? 'Seguimiento de la canción' : 'Guía manual · Sin audio'}</span>
        <span>{active >= 0 ? `Línea ${active + 1} de ${result.synced.length}` : 'Esperando la primera línea'}</span>
      </div>}
      <div className="lyrics__container" ref={containerElement} tabIndex={0} role="region" aria-label="Texto de la canción"
        onWheel={readFreely} onTouchStart={readFreely}
        onPointerDown={event => { if (event.target === event.currentTarget) readFreely(); }}
        onKeyDown={event => {
          if (event.target === event.currentTarget && ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) readFreely();
        }}>
        {hasLineTimings ? result.synced.map((line, index) => (
          <div key={`${line.time}-${index}`} ref={index === active ? activeElement : undefined}
            className={`lyrics__line${index === active ? ' lyrics__line--active' : index < active ? ' lyrics__line--passed' : ''}`}
            aria-current={index === active ? 'true' : undefined} data-line-time={isTimedPlayback ? line.time : undefined}>
            {line.words.join(' ')}
          </div>
        )) : <div className="lyrics__plain" data-testid="plain-lyrics">{result.text}</div>}
      </div>
      {showProgress && <div className="lyrics__progress">
        <div className="lyrics__progress-text">{formatTime(clamped)} / {formatTime(duration)} · {paused ? 'En pausa' : 'Reproduciendo'}</div>
        <div className="lyrics__progress-bar" role="progressbar" aria-label="Progreso de la canción" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={clamped}>
          <div className="lyrics__progress-fill" style={{ width: `${clamped / duration * 100}%` }} />
        </div>
      </div>}
      <div className="lyrics__tools">
        {hasLineTimings && !followsPlayback && result.synced.length > 0 && <div className="lyrics__manual-controls">
          <button type="button" disabled={active <= 0} onClick={() => setManualLine(Math.max(0, active - 1))}>Anterior</button>
          <button type="button" disabled={active >= result.synced.length - 1} onClick={() => setManualLine(Math.min(result.synced.length - 1, active + 1))}>Siguiente línea</button>
        </div>}
        {isTimedPlayback && <button type="button" aria-pressed={autoFollow} onClick={() => setAutoFollow(!autoFollow)}>Seguir línea actual</button>}
        <label className="lyrics__size">Tamaño de letra
          <select value={readingSize} onChange={event => setReadingSize(event.target.value)}>
            <option value="compact">Compacta</option><option value="normal">Normal</option><option value="large">Grande</option>
          </select>
        </label>
      </div>
    </div>
  );
}

export function formatTime(ms: number): string {
  const seconds = Math.floor(Math.max(0, Number.isFinite(ms) ? ms : 0) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
export default Lyrics;
