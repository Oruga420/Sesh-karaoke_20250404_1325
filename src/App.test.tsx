/* eslint testing-library/no-unnecessary-act: "off" -- ReactDOM tests require act; Testing Library is not used. */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import App from './App';
import { clearSpotifySession, getValidAccessToken, spotifyRequest } from './spotify';
import { deferred, fixtureLyrics, fixtureRecording, fixtureResponse } from './services/lyricsTestFixtures';
import { PlaybackSnapshot, SpotifyTrack } from './services/playbackPolling';
import { exportLyricsJson, MAX_JSON_BYTES } from './services/lyricsService';

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
async function search(values = manualRecording) {
  act(() => {
    for (const [name, value] of Object.entries({ title: values.title, artist: values.artist, album: values.album })) {
      const input = host.querySelector<HTMLInputElement>(`#lyrics-${name}`)!;
      input.value = value; Simulate.change(input);
    }
  });
  await act(async () => Simulate.submit(host.querySelector('form[aria-label="Buscar letras"]')!));
}
function button(label: string) {
  return Array.from(host.querySelectorAll('button')).find(item => item.getAttribute('aria-label') === label || item.textContent?.trim() === label)!;
}
function expectQuery(values = manualRecording) {
  for (const [name, value] of Object.entries({ title: values.title, artist: values.artist, album: values.album })) {
    expect(host.querySelector<HTMLInputElement>(`#lyrics-${name}`)?.value).toBe(value);
  }
}
function expectFinderVisible(visible: boolean) {
  const finder = host.querySelector<HTMLElement>('#song-search');
  expect(finder).not.toBeNull();
  expect(finder?.hidden).toBe(!visible);
}
async function chooseFile(file: Pick<File, 'size' | 'text'>) {
  const input = host.querySelector<HTMLInputElement>('[aria-label="Importar letras JSON"]')!;
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  await act(async () => Simulate.change(input));
}

it('allows manual online lookup without Spotify login and shows real plaintext/source/device attribution', async () => {
  request.mockResolvedValue(fixtureResponse(fixtureLyrics({ requested: manualRecording, sourceUrl: 'https://lrclib.net/api/get/1' })));
  await render(); await search();
  expect(playbackRequest).not.toHaveBeenCalled();
  expect(host.querySelector('[data-testid="lyrics-result"]')?.getAttribute('data-state')).toBe('plain');
  expect(host.querySelector('[data-testid="plain-lyrics"]')?.textContent).toContain('Synthetic first line');
  expect(host.querySelector('[data-testid="lyrics-source"]')?.getAttribute('href')).toBe('https://lrclib.net/api/get/1');
  expect(host.querySelector('[data-testid="device-save-status"]')?.textContent).toContain('Guardada en este dispositivo');
  expect(button('Descargar letras JSON')).toBeDefined();
});

it('opens a reader with one page heading and returns to the same query with title focus', async () => {
  request.mockResolvedValue(fixtureResponse(fixtureLyrics({ requested: manualRecording })));
  await render();
  const form = host.querySelector('form[aria-label="Buscar letras"]');
  expectFinderVisible(true);
  expect(host.querySelectorAll('h1')).toHaveLength(1);
  expect(button('Conectar Spotify')).toBeDefined();
  await search();
  expectFinderVisible(false);
  expect(host.querySelector('form[aria-label="Buscar letras"]')).toBe(form);
  expect(host.querySelectorAll('h1')).toHaveLength(1);
  expectQuery();
  await act(async () => button('Buscar otra canción').click());
  expectFinderVisible(true);
  expectQuery();
  expect(document.activeElement).toBe(host.querySelector('#lyrics-title'));
  expect(host.querySelectorAll('h1')).toHaveLength(1);
  expect(request).toHaveBeenCalledTimes(1);
});

it('keeps the query available throughout loading and failure, then opens the retried result', async () => {
  const pending = deferred<Response>();
  request.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(fixtureResponse(fixtureLyrics({ requested: manualRecording })));
  await render(); await search();
  expect(host.querySelector('[data-testid="lyrics-result"]')?.getAttribute('data-state')).toBe('loading');
  expectFinderVisible(true);
  expectQuery();
  expect(host.querySelector('[data-testid="plain-lyrics"]')).toBeNull();
  await act(async () => pending.reject(new TypeError('Synthetic network failure')));
  expect(host.querySelector('[data-testid="lyrics-result"]')?.getAttribute('data-state')).toBe('error');
  expectFinderVisible(true);
  expectQuery();
  await act(async () => button('Reintentar').click());
  expect(host.querySelector('[data-testid="lyrics-result"]')?.getAttribute('data-state')).toBe('plain');
  expectFinderVisible(false);
  await act(async () => button('Buscar otra canción').click());
  expectQuery();
  expect(request).toHaveBeenCalledTimes(2);
});

it('offers an honest manual line guide without a playback clock or synchronization offset', async () => {
  jest.useFakeTimers();
  request.mockResolvedValue(fixtureResponse(fixtureLyrics({ requested: manualRecording, timing: 'line',
    synced: [{ time: 0, words: ['Synthetic zero'] }, { time: 5, words: ['Synthetic five'] }] })));
  await render(); await search();
  const result = host.querySelector('[data-testid="lyrics-result"]')!;
  expect(result.getAttribute('data-state')).toBe('synced');
  expect(result.textContent).toContain('Guía manual · Sin audio');
  expect(result.querySelector('[role="progressbar"]')).toBeNull();
  expect(host.querySelector('[aria-label="Desfase de la letra"]')).toBeNull();
  expect(result.textContent).not.toContain('Reproduciendo');
  expect(result.textContent).not.toContain('En pausa');
  await act(async () => jest.advanceTimersByTime(6000));
  expect(host.querySelector('[aria-current="true"]')?.textContent).toBe('Synthetic zero');
  await act(async () => button('Siguiente línea').click());
  expect(host.querySelector('[aria-current="true"]')?.textContent).toBe('Synthetic five');
  expect(playbackRequest).not.toHaveBeenCalled();
});

it('rejects oversized lyric JSON before reading the file and keeps the selected result', async () => {
  request.mockResolvedValue(fixtureResponse(fixtureLyrics({ requested: manualRecording })));
  await render(); await search();
  const read = jest.fn();
  await chooseFile({ size: MAX_JSON_BYTES + 1, text: read });
  expect(read).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('El JSON de letras debe ocupar menos de 1 MB');
  expect(host.querySelector('[data-testid="plain-lyrics"]')?.textContent).toContain('Synthetic first line');
  expect(host.querySelector('[data-testid="lyrics-result"]')?.getAttribute('data-state')).toBe('plain');
});

it('ignores a late file read when a newer song has been selected', async () => {
  const file = deferred<string>();
  const newer = { ...manualRecording, title: 'Newer synthetic song' };
  request.mockResolvedValue(fixtureResponse(fixtureLyrics({ requested: newer, songInfo: newer, text: 'Newer synthetic lyrics' })));
  await render();
  await chooseFile({ size: 100, text: () => file.promise });
  await search(newer);
  await act(async () => file.resolve(exportLyricsJson(fixtureLyrics({ text: 'Stale imported lyrics' }))));
  expect(host.querySelector('[data-testid="plain-lyrics"]')?.textContent).toBe('Newer synthetic lyrics');
  expect(host.textContent).not.toContain('Stale imported lyrics');
  expectQuery(newer);
});

it('keeps an imported result when the superseded lookup completes later', async () => {
  const pending = deferred<Response>();
  request.mockReturnValue(pending.promise);
  const importedRecording = { ...manualRecording, title: 'Imported synthetic song' };
  const json = exportLyricsJson(fixtureLyrics({ requested: importedRecording, songInfo: importedRecording, text: 'Imported synthetic lyrics' }));
  await render(); await search();
  await chooseFile({ size: 100, text: async () => json });
  expect(host.querySelector('[data-testid="plain-lyrics"]')?.textContent).toBe('Imported synthetic lyrics');
  expectFinderVisible(false);
  await act(async () => pending.resolve(fixtureResponse(fixtureLyrics({ requested: manualRecording, text: 'Superseded online lyrics' }))));
  expect(host.querySelector('[data-testid="plain-lyrics"]')?.textContent).toBe('Imported synthetic lyrics');
  expect(host.textContent).not.toContain('Superseded online lyrics');
  expect(host.querySelector('[data-testid="lyrics-result"]')?.getAttribute('data-state')).toBe('plain');
});

it('renders typed404,503, and same-track Retry after cooldown as distinct states', async () => {
  jest.useFakeTimers();
  const empty = { requested: manualRecording, text: '', source: null, sourceUrl: null, songInfo: null, confidence: 'none' as const };
  request.mockResolvedValueOnce(fixtureResponse(fixtureLyrics({ ...empty, status: 'not_found' }), 404))
    .mockResolvedValueOnce(fixtureResponse(fixtureLyrics({ ...empty, status: 'unavailable', retryAfter: 2 }), 503, '2'))
    .mockResolvedValueOnce(fixtureResponse(fixtureLyrics({ requested: manualRecording })));
  await render(); await search();
  expect(host.querySelector('[data-testid="lyrics-result"]')?.getAttribute('data-state')).toBe('missing');
  expectFinderVisible(true);
  await act(async () => button('Reintentar').click());
  expect(host.querySelector('[data-testid="lyrics-result"]')?.getAttribute('data-state')).toBe('error');
  expect(button('Reintentar').disabled).toBe(true);
  expect(host.textContent).toContain('Podrás reintentar en 2 s');
  await search(); expect(request).toHaveBeenCalledTimes(2);
  await act(async () => jest.advanceTimersByTime(2000));
  expect(button('Reintentar').disabled).toBe(false);
  await act(async () => button('Reintentar').click());
  expect(request).toHaveBeenCalledTimes(3);
  expect(host.querySelector('[data-testid="lyrics-result"]')?.getAttribute('data-state')).toBe('plain');
});

it('shows an offline message for an uncached manual lookup', async () => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  await render(); await search();
  expect(host.querySelector('[data-testid="lyrics-result"]')?.getAttribute('data-state')).toBe('offline');
  expect(host.textContent).toContain('No hay letras guardadas para esta grabación');
  expectFinderVisible(true);
  expectQuery();
  expect(request).not.toHaveBeenCalled();
});

it('renders an instrumental result as a terminal source state without inventing vocal lines', async () => {
  request.mockResolvedValue(fixtureResponse(fixtureLyrics({ requested: manualRecording, status: 'instrumental', text: '' })));
  await render(); await search();
  expect(host.querySelector('[data-testid="lyrics-result"]')?.getAttribute('data-state')).toBe('instrumental');
  expect(host.textContent).toContain('No hay letra vocal disponible');
  expectFinderVisible(false);
  expect(host.querySelector('.lyrics__line')).toBeNull();
  expect(host.querySelector('[data-testid="plain-lyrics"]')).toBeNull();
});

it('shows connection failure as an error with a retry affordance and no fabricated lyrics', async () => {
  request.mockRejectedValue(new TypeError('Synthetic network failure'));
  await render(); await search();
  expect(host.querySelector('[data-testid="lyrics-result"]')?.getAttribute('data-state')).toBe('error');
  expect(host.textContent).toContain('No se pudo conectar con el servicio de letras');
  expect(button('Reintentar').disabled).toBe(false);
  expectFinderVisible(true);
  expectQuery();
  expect(host.querySelector('.lyrics__line')).toBeNull();
});

it.each(['manual lookup', 'JSON import'])('preserves lyrics selected by %s through Spotify track changes, empty playback and expired authorization', async mode => {
  jest.useFakeTimers(); access.mockResolvedValue('fixture-access');
  const track: SpotifyTrack = { id: 'fixture-track', name: fixtureRecording.title, duration_ms: fixtureRecording.duration,
    artists: [{ name: fixtureRecording.artist }], album: { name: fixtureRecording.album, images: [] } };
  const nextTrack = { ...track, id: 'next-fixture-track', name: 'Next Spotify synthetic song' };
  const snapshot = (item: SpotifyTrack): PlaybackSnapshot => ({ item, progress_ms: 0, is_playing: false });
  const spotifyRecording = { ...fixtureRecording, trackId: track.id };
  const selected = { ...manualRecording, title: 'Independent synthetic song' };
  const independent = fixtureLyrics({ requested: selected, songInfo: selected, text: 'Independent synthetic lyrics' });
  const json = exportLyricsJson(independent);
  playbackRequest.mockResolvedValueOnce(snapshot(track)).mockResolvedValueOnce(snapshot(nextTrack))
    .mockResolvedValueOnce(null).mockRejectedValueOnce(Object.assign(new Error('Synthetic authorization expired'), { status: 401, authRequired: true }));
  request.mockResolvedValueOnce(fixtureResponse(fixtureLyrics({ requested: spotifyRecording, songInfo: spotifyRecording })))
    .mockResolvedValue(fixtureResponse(independent));
  await render();
  expect(host.querySelector('[data-testid="spotify-player"]')?.textContent).toContain(track.name);
  if (mode === 'manual lookup') {
    await act(async () => button('Buscar otra canción').click());
    await search(selected);
  } else await chooseFile({ size: json.length, text: async () => json });
  const expectSelected = () => {
    expect(host.querySelector('[data-testid="lyrics-result"]')?.getAttribute('data-state')).toBe('plain');
    expect(host.querySelector('[data-testid="plain-lyrics"]')?.textContent).toBe('Independent synthetic lyrics');
    expectFinderVisible(false);
  };
  expectSelected();
  expect(button('Usar canción de Spotify')).toBeDefined();
  await act(async () => jest.advanceTimersByTime(1000));
  expect(host.querySelector('[data-testid="spotify-player"]')?.textContent).toContain(nextTrack.name);
  expectSelected();
  await act(async () => jest.advanceTimersByTime(1000));
  expect(host.querySelector('[data-testid="spotify-player"]')).toBeNull();
  expect(clearSpotifySession).not.toHaveBeenCalled();
  expectSelected();
  await act(async () => jest.advanceTimersByTime(1000));
  expect(playbackRequest).toHaveBeenCalledTimes(4);
  expect(clearSpotifySession).toHaveBeenCalledTimes(1);
  expect(button('Conectar Spotify')).toBeDefined();
  expectSelected();
  expect(request).toHaveBeenCalledTimes(mode === 'manual lookup' ? 2 : 1);
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
