import { LyricsResult, Recording } from './lyricsService';

export const fixtureRecording: Recording = { title: 'Synthetic song', artist: 'Fixture artist', album: 'Fixture album', duration: 180000 };
export function fixtureLyrics(overrides: Partial<LyricsResult> = {}): LyricsResult {
  return { status: 'found', timing: 'none', text: 'Synthetic first line\nSynthetic second line', synced: [],
    source: 'lrclib.net', sourceUrl: 'https://lrclib.net/api/get/1', requested: { ...fixtureRecording },
    songInfo: { ...fixtureRecording }, confidence: 'exact', fetchedAt: new Date().toISOString(),
    cache: { hit: false, storage: 'memory', persisted: false }, ...overrides };
}
export function fixtureResponse(lyrics: LyricsResult, status = 200, retryAfter: string | null = null): Response {
  return { status, headers: { get: (name: string) => name === 'Retry-After' ? retryAfter : null },
    text: async () => JSON.stringify({ lyrics }) } as unknown as Response;
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
