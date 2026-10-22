/* eslint testing-library/no-unnecessary-act: "off" -- ReactDOM tests require act; Testing Library is not used. */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import Lyrics, { activeLineIndex } from './Lyrics';
import { fixtureLyrics } from '../services/lyricsTestFixtures';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement('div'); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); });

it('renders genuine plain lyrics as escaped text without fabricated synchronized lines', () => {
  act(() => root.render(<Lyrics result={fixtureLyrics({ text: 'Synthetic first line\n<script>fixture</script>' })} progress={0} duration={0} paused />));
  expect(host.textContent).toContain('Synthetic first line\n<script>fixture</script>');
  expect(host.querySelector('script')).toBeNull();
  expect(host.querySelector('.lyrics__line--active')).toBeNull();
});

it('derives one active line at zero, across forward and backward seeks, and while paused', () => {
  const lyrics = fixtureLyrics({ timing: 'line', synced: [
    { time: 0, words: ['Synthetic zero'] }, { time: 2, words: ['Synthetic two'] }, { time: 5, words: ['Synthetic five'] },
  ] });
  const render = (progress: number, paused = false) => act(() => root.render(<Lyrics result={lyrics} progress={progress} duration={10000} paused={paused} />));
  for (const [progress, text, paused] of [[0, 'Synthetic zero', false], [6000, 'Synthetic five', false], [2500, 'Synthetic two', false], [2500, 'Synthetic two', true]] as const) {
    render(progress, paused);
    expect(host.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
    expect(host.querySelector('[aria-current="true"]')?.textContent).toBe(text);
  }
  expect(host.querySelector('.lyrics__word--current')).toBeNull();
});

it('does not highlight before the first real timestamp and clamps progress display', () => {
  expect(activeLineIndex([{ time: 0, words: ['Synthetic'] }], -500)).toBe(-1);
  expect(activeLineIndex([{ time: 5, words: ['Synthetic'] }], 0)).toBe(-1);
  act(() => root.render(<Lyrics result={fixtureLyrics({ timing: 'line', synced: [{ time: 5, words: ['Synthetic'] }] })} progress={-1000} duration={10000} paused />));
  expect(host.querySelector('[aria-current="true"]')).toBeNull();
  expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('0');
  act(() => root.render(<Lyrics result={fixtureLyrics()} progress={20000} duration={10000} paused />));
  expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('10000');
});
