import { clampProgress, PlaybackSnapshot, startPlaybackPolling } from './playbackPolling';
import { deferred } from './lyricsTestFixtures';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

it('allows one in-flight poll, schedules after settlement, and aborts on cleanup', async () => {
  const pending = deferred<PlaybackSnapshot | null>();
  const request = jest.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(null);
  const onPlayback = jest.fn();
  const stop = startPlaybackPolling({ request, onPlayback, onError: jest.fn() });
  jest.advanceTimersByTime(5000); expect(request).toHaveBeenCalledTimes(1);
  pending.resolve(null); await flush();
  jest.advanceTimersByTime(999); expect(request).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1); await flush(); expect(request).toHaveBeenCalledTimes(2);
  const signal = request.mock.calls[1][0];
  stop(); expect(signal.aborted).toBe(true);
  jest.advanceTimersByTime(5000); expect(request).toHaveBeenCalledTimes(2);
});

it('honors a429 Retry-After delay then resumes normal polling', async () => {
  const request = jest.fn().mockRejectedValueOnce({ status: 429, retryAfter: 4 }).mockResolvedValue(null);
  const onError = jest.fn();
  const stop = startPlaybackPolling({ request, onPlayback: jest.fn(), onError });
  await flush(); jest.advanceTimersByTime(3999); expect(request).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1); await flush(); expect(request).toHaveBeenCalledTimes(2);
  expect(onError).toHaveBeenCalledWith({ status: 429, retryAfter: 4 }); stop();
});

it('recovers from transient errors while terminal auth failure stops polling', async () => {
  const request = jest.fn().mockRejectedValueOnce({ status: 503 }).mockResolvedValueOnce(null).mockRejectedValue({ status: 401, authRequired: true });
  const stop = startPlaybackPolling({ request, onPlayback: jest.fn(), onError: jest.fn() });
  await flush(); jest.advanceTimersByTime(2000); await flush(); expect(request).toHaveBeenCalledTimes(2);
  jest.advanceTimersByTime(1000); await flush(); expect(request).toHaveBeenCalledTimes(3);
  jest.advanceTimersByTime(10000); expect(request).toHaveBeenCalledTimes(3); stop();
});

it('ignores a late response after unmount', async () => {
  const pending = deferred<PlaybackSnapshot | null>(); const onPlayback = jest.fn();
  const stop = startPlaybackPolling({ request: () => pending.promise, onPlayback, onError: jest.fn() });
  stop(); pending.resolve(null); await flush();
  expect(onPlayback).not.toHaveBeenCalled();
});

it('clamps invalid, negative, and past-duration progress', () => {
  expect(clampProgress(-10, 100)).toBe(0); expect(clampProgress(110, 100)).toBe(100);
  expect(clampProgress(NaN, 100)).toBe(0); expect(clampProgress(5, 0)).toBe(0);
});
