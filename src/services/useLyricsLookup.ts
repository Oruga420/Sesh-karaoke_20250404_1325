import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchLyrics, getLastSavedLyrics, LyricsLookup, LyricsRequestError, Recording, recordingKey } from './lyricsService';

export interface LyricsView {
  phase: 'idle' | 'loading' | 'ready' | 'offline' | 'error';
  requested: Recording | null;
  lookup: LyricsLookup | null;
  message: string;
  retryAt: number;
}
export function useLyricsLookup() {
  const [view, setView] = useState<LyricsView>(() => {
    const lookup = getLastSavedLyrics();
    return { phase: lookup ? 'ready' : 'idle', requested: lookup?.lyrics.requested || null,
      lookup, message: '', retryAt: 0 };
  });
  const generation = useRef(0);
  const active = useRef<AbortController | null>(null);
  const current = useRef(view);
  current.current = view;
  const clear = useCallback(() => {
    generation.current += 1;
    active.current?.abort();
    setView({ phase: 'idle', requested: null, lookup: null, message: '', retryAt: 0 });
  }, []);
  const load = useCallback(async (requested: Recording, bypassCache = false) => {
    if (current.current.requested && recordingKey(current.current.requested) === recordingKey(requested) &&
      Date.now() < current.current.retryAt) return;
    const id = ++generation.current;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setView({ phase: 'loading', requested, lookup: null, message: '', retryAt: 0 });
    try {
      const lookup = await fetchLyrics(requested, { signal: controller.signal, bypassCache });
      if (generation.current !== id || controller.signal.aborted) return;
      setView({ phase: 'ready', requested, lookup, message: '',
        retryAt: lookup.lyrics.retryAfter ? Date.now() + lookup.lyrics.retryAfter * 1000 : 0 });
    } catch (error) {
      if (generation.current !== id || controller.signal.aborted) return;
      const details = error instanceof LyricsRequestError ? error : new LyricsRequestError('The lyrics lookup failed. Please retry.');
      setView({ phase: details.offline ? 'offline' : 'error', requested, lookup: null,
        message: details.message, retryAt: details.retryAfter ? Date.now() + details.retryAfter * 1000 : 0 });
    }
  }, []);
  const retry = useCallback(() => {
    if (current.current.requested && Date.now() >= current.current.retryAt && current.current.phase !== 'loading') {
      void load(current.current.requested, true);
    }
  }, [load]);
  const imported = useCallback((lookup: LyricsLookup) => {
    generation.current += 1;
    active.current?.abort();
    setView({ phase: 'ready', requested: lookup.lyrics.requested, lookup, message: '', retryAt: 0 });
  }, []);
  useEffect(() => () => { generation.current += 1; active.current?.abort(); }, []);
  return { view, load, clear, retry, imported };
}
