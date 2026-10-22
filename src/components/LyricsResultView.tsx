import React, { useEffect, useRef, useState } from 'react';
import { exportLyricsJson, importLyricsJson, LyricsLookup, MAX_JSON_BYTES, safeSourceUrl } from '../services/lyricsService';
import { LyricsView } from '../services/useLyricsLookup';
import Lyrics from './Lyrics';

interface Props {
  view: LyricsView;
  progress: number;
  duration: number;
  paused: boolean;
  onRetry: () => void;
  onImport: (lookup: LyricsLookup) => void;
  onReturnToSearch?: () => void;
  reading?: boolean;
  followsPlayback?: boolean;
  tools?: React.ReactNode;
  onToggleWide?: () => void;
  wide?: boolean;
}

const lookupMessages: Record<string, string> = {
  'Enter a song title and artist.': 'Escribe el título y el artista para buscar.',
  'You are offline. No saved lyrics for this recording.': 'Sin conexión. No hay letras guardadas para esta grabación. Vuelve a conectarte para buscar.',
  'Lyrics response is too large.': 'La respuesta de letras es demasiado grande. Prueba otra búsqueda.',
  'The lyrics service returned an invalid response.': 'El servicio de letras devolvió una respuesta inválida. Reintenta la búsqueda.',
  'The lyrics service could not complete this lookup.': 'El servicio de letras no pudo completar esta búsqueda. Reinténtalo en unos instantes.',
  'The lyrics lookup timed out. Please retry.': 'La búsqueda tardó demasiado. Reinténtalo en unos instantes.',
  'Could not connect to the lyrics service. Check your connection and retry.': 'No se pudo conectar con el servicio de letras. Comprueba la conexión y reintenta.',
  'The lyrics lookup failed. Please retry.': 'No se pudo completar la búsqueda de letras. Reinténtalo.',
};

const fileMessages: Record<string, string> = {
  'Only retrieved lyrics can be exported.': 'Solo se pueden descargar letras recuperadas. Busca o importa una letra válida.',
  'Lyrics JSON is too large.': 'El JSON de letras es demasiado grande para descargarlo.',
  'Lyrics JSON must be smaller than 1 MB.': 'El JSON de letras debe ocupar menos de 1 MB.',
  'Choose a valid lyrics JSON file.': 'Elige un archivo JSON de letras válido.',
  'Unsupported or invalid lyrics JSON.': 'El archivo no tiene un formato de letras compatible. Elige un JSON descargado desde esta aplicación.',
};

function LyricsResultView({ view, progress, duration, paused, onRetry, onImport, onReturnToSearch,
  reading = false, followsPlayback = false, tools, onToggleWide, wide = false }: Props) {
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
  const recording = view.requested || result?.requested;
  const hasLyrics = result?.status === 'found';
  const statusLabel = state === 'plain' ? 'Texto sin tiempos' : state === 'synced' ? 'Con tiempos por línea' :
    state === 'idle' ? 'Sin canción' : state === 'loading' ? 'Buscando' : state === 'missing' ? 'Sin resultado' :
      state === 'instrumental' ? 'Instrumental' : state === 'offline' ? 'Sin conexión' : 'Búsqueda interrumpida';
  const lookupMessage = lookupMessages[view.message] || view.message;
  const message = state === 'loading' ? 'Buscando letras…' :
    state === 'missing' ? 'No encontramos letras para esta grabación. Revisa el título y el artista, o reintenta.' :
      state === 'instrumental' ? 'La fuente identifica esta grabación como instrumental. No hay letra vocal disponible.' :
        state === 'offline' ? lookupMessage || 'Sin conexión. Vuelve a conectarte para buscar o importa un archivo JSON guardado.' :
          state === 'error' ? lookupMessage || 'Los proveedores de letras no están disponibles por el momento. Reinténtalo en unos instantes.' : '';

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
    } catch (error) {
      setFileError((error instanceof Error && fileMessages[error.message]) || 'No se pudo descargar el JSON de letras. Reinténtalo.');
    }
  }
  return <section className="lyrics-result" aria-label="Letras" data-testid="lyrics-result" data-state={state}>
    <div className="lyrics-result__stage">
      <div className="lyrics-result__heading"><h2>Letras</h2><span className="lyrics-result__badge">{statusLabel}</span></div>
      {recording && <div className="lyrics-result__recording"><h3>{recording.title}</h3><p>{recording.artist}</p></div>}
      {state === 'idle' && <div className="lyrics-result__empty">
        <span className="lyrics-result__cue" aria-hidden="true" />
        <p className="lyrics-result__empty-title">Aquí va tu voz.</p>
        <p className="lyrics-result__empty-copy">Busca una canción por título y artista para abrir sus letras y cantar.</p>
      </div>}
      <div role="status" aria-live="polite" aria-atomic="true" className="lyrics-result__message">
        {message && <p>{message}</p>}
        {retryIn > 0 && <p>Podrás reintentar en {retryIn} s.</p>}
      </div>
      {hasLyrics && <>
        <p className="lyrics-result__timing">{result.timing === 'none' ? 'Lee a tu ritmo. Esta letra no incluye tiempos.' :
          followsPlayback ? 'Sigue la reproducción de Spotify.' : 'Los tiempos por línea están disponibles; la lectura no sigue audio.'}</p>
        <Lyrics result={result} progress={progress} duration={duration} paused={paused} followsPlayback={followsPlayback} />
      </>}
      {tools && <div className="lyrics-result__tools">{tools}</div>}
      {view.requested && !hasLyrics && state !== 'loading' && <div className="lyrics-result__actions">
        <button type="button" onClick={onRetry} disabled={retryIn > 0}>Reintentar</button>
      </div>}
      {reading && <div className="lyrics-result__reader-actions">
        {onReturnToSearch && <button type="button" onClick={onReturnToSearch}>Buscar otra canción</button>}
        {onToggleWide && <button type="button" onClick={onToggleWide} aria-pressed={wide}>{wide ? 'Vista normal' : 'Vista amplia'}</button>}
      </div>}
    </div>
    <div className="lyrics-result__library">
      <h3>Tus letras, a mano</h3>
      {result && canExport ? <>
        <div className="lyrics-result__metadata">
          {view.lookup?.imported && <p className="lyrics-result__attribution">Importado de JSON. La fuente y los metadatos proceden del archivo.</p>}
          <p>Fuente: {sourceUrl ? <a data-testid="lyrics-source" href={sourceUrl} target="_blank" rel="noreferrer noopener">{result.source || 'Consultar fuente'}</a> : result.source || 'Sin especificar'} · {result.status === 'instrumental' ? 'Sin letra vocal' : result.timing === 'line' ? 'Con tiempos por línea' : 'Texto sin tiempos'}.</p>
          <p data-testid="device-save-status">{view.lookup?.savedOnDevice ? 'Guardada en este dispositivo' : 'No guardada en este dispositivo'} · el navegador puede borrar esta copia.</p>
          {view.lookup?.fromDevice && <p>Cargada desde este dispositivo{navigator.onLine === false ? ' · sin conexión' : ''}.</p>}
        </div>
        <details className="lyrics-result__provenance">
          <summary>Fuente, tiempos y archivo</summary>
          {result.confidence === 'title-artist' ? <p>Búsqueda por título y artista · coincidencia de grabación sin verificar.</p> :
            <p>Coincidencia: {result.confidence === 'exact' ? 'metadatos exactos de la grabación' : result.confidence === 'matched' ? 'metadatos de grabación coincidentes' : 'sin verificar'}.</p>}
          {result.requested.album && <p>Álbum buscado: {result.requested.album}</p>}
          {result.songInfo && <p>Resultado de la fuente: {result.songInfo.title} · {result.songInfo.artist}{result.songInfo.album && ` · ${result.songInfo.album}`}</p>}
          <p>Recuperada el <time dateTime={result.fetchedAt}>{new Date(result.fetchedAt).toLocaleString('es')}</time>.</p>
          <p className="lyrics-result__cache">Caché de la API: {result.cache.storage === 'disk' ? 'disco local del servidor' : result.cache.storage === 'memory' ? 'memoria temporal del servidor' : 'sin caché'}{result.cache.hit ? ' (respuesta de caché)' : ''}. Es independiente de la copia de este dispositivo.</p>
          <div className="lyrics-result__actions">
            <button type="button" aria-label="Descargar letras JSON" onClick={download}>Descargar letras JSON</button>
            {hasLyrics && <button type="button" aria-label="Reintentar" onClick={onRetry} disabled={retryIn > 0}>Reintentar</button>}
          </div>
        </details>
      </> : <p>Importa un archivo JSON de letras para abrirlo aquí, también sin conexión.</p>}
      <details className="lyrics-result__file-import">
        <summary>Importar letras JSON</summary>
        <p>Elige un archivo descargado desde esta aplicación, de menos de 1 MB.</p>
        <label className="lyrics-result__import" htmlFor="lyrics-import">Archivo de letras JSON
          <input id="lyrics-import" type="file" accept="application/json,.json" aria-label="Importar letras JSON" onChange={async event => {
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
            } catch (error) {
              if (id === importGeneration.current) setFileError((error instanceof Error && fileMessages[error.message]) ||
                'No se pudo leer el archivo de letras. Vuelve a elegir un JSON válido.');
            }
          }} />
        </label>
      </details>
      {fileError && <p role="alert">{fileError}</p>}
    </div>
  </section>;
}
export default LyricsResultView;
