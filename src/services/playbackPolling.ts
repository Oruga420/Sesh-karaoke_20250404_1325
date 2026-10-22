export interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms: number;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
}
export interface PlaybackSnapshot {
  item: SpotifyTrack | null;
  progress_ms: number | null;
  is_playing: boolean;
}
interface PollingOptions {
  request: (signal: AbortSignal) => Promise<PlaybackSnapshot | null>;
  onPlayback: (playback: PlaybackSnapshot | null) => void;
  onError: (error: unknown) => void;
  intervalMs?: number;
}
// Schedule only after the previous request settles. Cleanup invalidates late responses.
export function startPlaybackPolling({ request, onPlayback, onError, intervalMs = 1000 }: PollingOptions): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  async function poll() {
    controller = new AbortController();
    let delay = intervalMs;
    try {
      const response = await request(controller.signal);
      if (!stopped) onPlayback(response);
    } catch (error) {
      if (stopped) return;
      const details = error as { status?: number; retryAfter?: number; authRequired?: boolean };
      if (details.status === 429) {
        delay = Math.max(intervalMs, Math.min(86400000, (details.retryAfter || 5) * 1000));
      } else { delay = Math.max(intervalMs, 2000); }
      onError(error);
      if (details.authRequired || details.status === 401) stopped = true;
    }
    if (!stopped) timer = setTimeout(poll, delay);
  }
  void poll();
  return () => { stopped = true; clearTimeout(timer); controller?.abort(); };
}
export function clampProgress(progress: number, duration: number): number {
  return Math.min(Math.max(0, Number.isFinite(duration) ? duration : 0), Math.max(0, Number.isFinite(progress) ? progress : 0));
}
