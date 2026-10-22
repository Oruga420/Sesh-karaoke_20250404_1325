/* eslint testing-library/no-unnecessary-act: "off" -- ReactDOM tests require act; Testing Library is not used. */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import App from './App';
import { clearSpotifySession, getValidAccessToken, spotifyRequest } from './spotify';
import { fixtureLyrics, fixtureRecording, fixtureResponse } from './services/lyricsTestFixtures';
import { PlaybackSnapshot, SpotifyTrack } from './services/playbackPolling';

jest.mock('./spotify', () => ({
  getValidAccessToken: jest.fn(), spotifyRequest: jest.fn(), clearSpotifySession: jest.fn(),
  exchangeCodeForToken: jest.fn(), storeSpotifyToken: jest.fn(), startSpotifyLogin: jest.fn(),
  getRedirectUri: () => 'http://127.0.0.1:3000/callback',
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const access = getValidAccessToken as jest.Mock;
const playbackRequest = spotifyRequest as jest.Mock;
let request: jest.Mock;
let host: HTMLDivElement;
let root: Root;
const manualRecording = { ...fixtureRecording, duration: 0 };
beforeEach(() => {
  localStorage.clear(); jest.clearAllMocks(); request = jest.fn(); global.fetch = request;
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  access.mockResolvedValue(null); host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); jest.useRealTimers(); });
async function render() { await act(async () => root.render(<App />)); }
async function search() {
  act(() => {
    for (const [name, value] of Object.entries({ title: manualRecording.title, artist: manualRecording.artist, album: manualRecording.album })) {
      const input = host.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
      input.value = value; Simulate.change(input);
    }
  });
  await act(async () => Simulate.submit(host.querySelector('form')!));
}
function button(label: string) { return Array.from(host.querySelectorAll('button')).find(item => item.textContent === label)!; }

it('allows manual online lookup without Spotify login and shows real plaintext/source/device attribution', async () => {
  request.mockResolvedValue(fixtureResponse(fixtureLyrics({ requested: manualRecording, sourceUrl: 'https://lrclib.net/api/get/1' })));
  await render(); await search();
  expect(playbackRequest).not.toHaveBeenCalled();
  expect(host.querySelector('[data-testid="lyrics-result"]')?.getAttribute('data-state')).toBe('plain');
  expect(host.querySelector('[data-testid="plain-lyrics"]')?.textContent).toContain('Synthetic first line');
  expect(host.querySelector('[data-testid="lyrics-source"]')?.getAttribute('href')).toBe('https://lrclib.net/api/get/1');
  expect(host.querySelector('[data-testid="device-save-status"]')?.textContent).toContain('Saved on this device');
  expect(button('Download lyrics JSON')).toBeDefined();
});

it('renders typed404,503, and same-track Retry after cooldown as distinct states', async () => {
  jest.useFakeTimers();
  const empty = { requested: manualRecording, text: '', source: null, sourceUrl: null, songInfo: null, confidence: 'none' as const };
  request.mockResolvedValueOnce(fixtureResponse(fixtureLyrics({ ...empty, status: 'not_found' }), 404))
    .mockResolvedValueOnce(fixtureResponse(fixtureLyrics({ ...empty, status: 'unavailable', retryAfter: 2 }), 503, '2'))
    .mockResolvedValueOnce(fixtureResponse(fixtureLyrics({ requested: manualRecording })));
  await render(); await search();
  expect(host.querySelector('[data-testid="lyrics-result"]')?.getAttribute('data-state')).toBe('missing');
  await act(async () => button('Retry lyrics').click());
  expect(host.querySelector('[data-testid="lyrics-result"]')?.getAttribute('data-state')).toBe('error');
  expect(button('Retry lyrics').disabled).toBe(true);
  expect(host.textContent).toContain('Retry available in 2s');
  await search(); expect(request).toHaveBeenCalledTimes(2);
  await act(async () => jest.advanceTimersByTime(2000));
  expect(button('Retry lyrics').disabled).toBe(false);
  await act(async () => button('Retry lyrics').click());
  expect(request).toHaveBeenCalledTimes(3);
  expect(host.querySelector('[data-testid="lyrics-result"]')?.getAttribute('data-state')).toBe('plain');
});

it('shows an offline message for an uncached manual lookup', async () => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  await render(); await search();
  expect(host.querySelector('[data-testid="lyrics-result"]')?.getAttribute('data-state')).toBe('offline');
  expect(host.textContent).toContain('No saved lyrics for this recording');
  expect(request).not.toHaveBeenCalled();
});

it('renders an instrumental result as a terminal source state without inventing vocal lines', async () => {
  request.mockResolvedValue(fixtureResponse(fixtureLyrics({ requested: manualRecording, status: 'instrumental', text: '' })));
  await render(); await search();
  expect(host.querySelector('[data-testid="lyrics-result"]')?.getAttribute('data-state')).toBe('instrumental');
  expect(host.textContent).toContain('No vocal lyrics are available');
  expect(host.querySelector('.lyrics__line')).toBeNull();
  expect(host.querySelector('[data-testid="plain-lyrics"]')).toBeNull();
});

it('shows connection failure as an error with a retry affordance and no fabricated lyrics', async () => {
  request.mockRejectedValue(new TypeError('Synthetic network failure'));
  await render(); await search();
  expect(host.querySelector('[data-testid="lyrics-result"]')?.getAttribute('data-state')).toBe('error');
  expect(host.textContent).toContain('Could not connect to the lyrics service');
  expect(button('Retry lyrics').disabled).toBe(false);
  expect(host.querySelector('.lyrics__line')).toBeNull();
});

it('updates playback and backwards/paused line position without refetching unchanged-track lyrics, and clears an empty player', async () => {
  jest.useFakeTimers(); access.mockResolvedValue('fixture-access');
  const track: SpotifyTrack = { id: 'fixture-track', name: fixtureRecording.title, duration_ms: 180000,
    artists: [{ name: fixtureRecording.artist }], album: { name: fixtureRecording.album, images: [] } };
  const snapshot = (progress_ms: number, is_playing: boolean): PlaybackSnapshot => ({ item: track, progress_ms, is_playing });
  playbackRequest.mockResolvedValueOnce(snapshot(0, true)).mockResolvedValueOnce(snapshot(6000, true))
    .mockResolvedValueOnce(snapshot(1000, false)).mockResolvedValue(null);
  request.mockResolvedValue(fixtureResponse(fixtureLyrics({ requested: { ...fixtureRecording, trackId: track.id }, timing: 'line',
    synced: [{ time: 0, words: ['Synthetic zero'] }, { time: 5, words: ['Synthetic five'] }] })));
  await render();
  expect(host.querySelector('[aria-current="true"]')?.textContent).toBe('Synthetic zero');
  await act(async () => jest.advanceTimersByTime(1000));
  expect(host.querySelector('[aria-current="true"]')?.textContent).toBe('Synthetic five');
  await act(async () => jest.advanceTimersByTime(1000));
  expect(host.querySelector('[aria-current="true"]')?.textContent).toBe('Synthetic zero');
  await act(async () => jest.advanceTimersByTime(500));
  expect(host.querySelector('[aria-current="true"]')?.textContent).toBe('Synthetic zero');
  expect(request).toHaveBeenCalledTimes(1);
  expect(playbackRequest.mock.calls[0][0]).toBe('/me/player/currently-playing');
  await act(async () => jest.advanceTimersByTime(500));
  expect(host.querySelector('[data-testid="spotify-player"]')).toBeNull();
  expect(host.querySelector('[data-testid="lyrics-result"]')?.getAttribute('data-state')).toBe('idle');
  expect(clearSpotifySession).not.toHaveBeenCalled();
});
