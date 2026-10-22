import React, { useEffect, useRef, useState } from 'react';
import { exportLyricsJson, importLyricsJson, LyricsLookup, MAX_JSON_BYTES, safeSourceUrl } from '../services/lyricsService';
import { LyricsView } from '../services/useLyricsLookup';
import Lyrics from './Lyrics';

interface Props { view: LyricsView; progress: number; duration: number; paused: boolean; onRetry: () => void; onImport: (lookup: LyricsLookup) => void }
function LyricsResultView({ view, progress, duration, paused, onRetry, onImport }: Props) {
  const [now, setNow] = useState(Date.now());
  const [fileError, setFileError] = useState('');
  const importGeneration = useRef(0);
  useEffect(() => {
    setNow(Date.now());
    if (view.retryAt <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [view.retryAt]);
  useEffect(() => () => { importGeneration.current += 1; }, []);
  useEffect(() => { importGeneration.current += 1; }, [view.requested, view.phase]);
  const result = view.lookup?.lyrics;
  const state = view.phase !== 'ready' ? view.phase : result?.status === 'found' ? result.timing === 'line' ? 'synced' : 'plain' : result?.status === 'not_found' ? 'missing' : result?.status === 'unavailable' ? 'error' : 'instrumental';
  const retryIn = Math.max(0, Math.ceil((view.retryAt - now) / 1000));
  const sourceUrl = safeSourceUrl(result?.sourceUrl || null);
  const canExport = result?.status === 'found' || result?.status === 'instrumental';
  function download() {
    if (!result) return;
    try {
      const blob = new Blob([exportLyricsJson(result)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${result.requested.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'lyrics'}.lyrics.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setFileError('');
    } catch (error) { setFileError(error instanceof Error ? error.message : 'Could not download lyrics JSON.'); }
  }
  return <section className="lyrics-result" aria-label="Lyrics result" data-testid="lyrics-result" data-state={state}>
    <div className="lyrics-result__heading"><h2>Lyrics</h2><span className="lyrics-result__badge">{state === 'plain' ? 'Plain text · no timing' : state === 'synced' ? 'Line synchronized' : state}</span></div>
    {view.requested && <p className="lyrics-result__recording">{view.requested.title} · {view.requested.artist}{view.requested.album && ` · ${view.requested.album}`}</p>}
    <div role="status" aria-live="polite" className="lyrics-result__message">
      {state === 'idle' && 'Find a song above, or import a saved lyrics JSON file.'}
      {state === 'loading' && 'Looking up lyrics…'}
      {state === 'missing' && 'No lyrics were found for this recording. Check the title and artist, or retry.'}
      {state === 'instrumental' && 'The source identifies this recording as instrumental. No vocal lyrics are available.'}
      {state === 'offline' && view.message}
      {state === 'error' && (view.message || 'The lyrics providers are temporarily unavailable. Please retry.')}
      {view.lookup?.fromDevice && <span>Loaded from this device{navigator.onLine === false ? ' · Offline' : ''}.</span>}
      {retryIn > 0 && <p>Retry available in {retryIn}s.</p>}
    </div>
    {result?.status === 'found' && <Lyrics result={result} progress={progress} duration={duration} paused={paused} />}
    {result && canExport && <div className="lyrics-result__metadata">
      {view.lookup?.imported && <p>Imported from JSON · source metadata supplied by the file.</p>}
      <p>Source: {sourceUrl ? <a data-testid="lyrics-source" href={sourceUrl} target="_blank" rel="noreferrer noopener">{result.source}</a> : result.source || 'Unspecified'}</p>
      {result.confidence === 'title-artist' ? <p>Title/artist text lookup · recording match unverified.</p> : <p>Match: {result.confidence === 'exact' ? 'Exact recording metadata' : 'Matched recording metadata'}</p>}
      {result.songInfo && <p>Returned: {result.songInfo.title} · {result.songInfo.artist}{result.songInfo.album && ` · ${result.songInfo.album}`}</p>}
      <p>Retrieved <time dateTime={result.fetchedAt}>{new Date(result.fetchedAt).toLocaleString()}</time></p>
      <p data-testid="device-save-status">{view.lookup?.savedOnDevice ? 'Saved on this device' : 'Not saved on this device'} · browser storage may be cleared or evicted.</p>
      <p className="lyrics-result__cache">API cache: {result.cache.storage === 'disk' ? 'local server disk' : result.cache.storage === 'memory' ? 'temporary server memory' : 'none'}{result.cache.hit ? ' (hit)' : ''}. Device storage is separate.</p>
    </div>}
    <div className="lyrics-result__actions">
      {view.requested && state !== 'loading' && <button type="button" onClick={onRetry} disabled={retryIn > 0}>Retry lyrics</button>}
      {canExport && <button type="button" className="secondary-button" onClick={download}>Download lyrics JSON</button>}
      <label className="lyrics-result__import" htmlFor="lyrics-import">Import lyrics JSON
        <input id="lyrics-import" type="file" accept="application/json,.json" aria-label="Import lyrics JSON" onChange={async event => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          const id = ++importGeneration.current;
          try {
            if (file.size > MAX_JSON_BYTES) throw new Error('Lyrics JSON must be smaller than 1 MB.');
            const text = await file.text();
            if (id !== importGeneration.current) return;
            const lookup = importLyricsJson(text);
            setFileError(''); onImport(lookup);
          } catch (error) { if (id === importGeneration.current) setFileError(error instanceof Error ? error.message : 'Could not import lyrics JSON.'); }
        }} />
      </label>
    </div>
    {fileError && <p role="alert">{fileError}</p>}
  </section>;
}
export default LyricsResultView;
