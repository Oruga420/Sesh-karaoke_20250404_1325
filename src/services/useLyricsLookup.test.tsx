import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { useLyricsLookup } from './useLyricsLookup';
import { fetchLyrics, LyricsLookup } from './lyricsService';
import { deferred, fixtureLyrics, fixtureRecording } from './lyricsTestFixtures';

jest.mock('./lyricsService', () => ({ ...jest.requireActual('./lyricsService'), fetchLyrics: jest.fn() }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const fetchMock = fetchLyrics as jest.Mock;
let host: HTMLDivElement;
let root: Root | null;
let state: ReturnType<typeof useLyricsLookup>;
function Harness() { state = useLyricsLookup(); return <pre>{JSON.stringify(state.view)}</pre>; }
beforeEach(() => {
  localStorage.clear(); fetchMock.mockReset(); host = document.createElement('div'); root = createRoot(host);
  act(() => root!.render(<Harness />));
});
afterEach(() => { if (root) act(() => root!.unmount()); jest.useRealTimers(); });
const lookup = (text: string): LyricsLookup => ({ lyrics: fixtureLyrics({ text }), savedOnDevice: false, fromDevice: false });

it('invalidates every generation including A-B-A and aborts superseded requests', async () => {
  const firstA = deferred<LyricsLookup>(); const b = deferred<LyricsLookup>(); const secondA = deferred<LyricsLookup>();
  fetchMock.mockReturnValueOnce(firstA.promise).mockReturnValueOnce(b.promise).mockReturnValueOnce(secondA.promise);
  act(() => { void state.load(fixtureRecording); });
  act(() => { void state.load({ ...fixtureRecording, title: 'Synthetic B' }); });
  expect(state.view.lookup).toBeNull(); expect(state.view.phase).toBe('loading');
  act(() => { void state.load(fixtureRecording); });
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  expect(fetchMock.mock.calls[1][1].signal.aborted).toBe(true);
  await act(async () => { secondA.resolve(lookup('Latest A synthetic text')); });
  await act(async () => { firstA.resolve(lookup('Stale A synthetic text')); b.reject(new Error('Stale failure')); });
  expect(state.view.lookup?.lyrics.text).toBe('Latest A synthetic text');
  expect(state.view.phase).toBe('ready');
});

it('clears prior content immediately when another song starts loading', async () => {
  fetchMock.mockResolvedValueOnce(lookup('Synthetic previous lyrics')).mockReturnValueOnce(new Promise(() => undefined));
  await act(async () => { await state.load(fixtureRecording); });
  expect(host.textContent).toContain('Synthetic previous lyrics');
  act(() => { void state.load({ ...fixtureRecording, title: 'Another synthetic song' }); });
  expect(state.view.lookup).toBeNull(); expect(host.textContent).not.toContain('Synthetic previous lyrics');
});

it('honors same-recording cooldown for Retry and manual resubmission', async () => {
  jest.useFakeTimers();
  const unavailable = lookup('');
  unavailable.lyrics = fixtureLyrics({ status: 'unavailable', text: '', synced: [], source: null, sourceUrl: null, songInfo: null, confidence: 'none', retryAfter: 2 });
  fetchMock.mockResolvedValueOnce(unavailable).mockResolvedValueOnce(lookup('Recovered synthetic text'));
  await act(async () => { await state.load(fixtureRecording); });
  act(() => state.retry());
  await act(async () => { await state.load(fixtureRecording); });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(2000));
  await act(async () => state.retry());
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][1].bypassCache).toBe(true);
  expect(state.view.lookup?.lyrics.text).toBe('Recovered synthetic text');
});

it('aborts on unmount and ignores late completion', async () => {
  const pending = deferred<LyricsLookup>(); fetchMock.mockReturnValue(pending.promise);
  act(() => { void state.load(fixtureRecording); });
  act(() => root!.unmount()); root = null;
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => pending.resolve(lookup('Synthetic late content')));
  expect(host.textContent).toBe('');
});
