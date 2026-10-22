/* eslint testing-library/no-unnecessary-act: "off" -- ReactDOM tests require act; Testing Library is not used. */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import Lyrics, { activeLineIndex } from './Lyrics';
import SyncControls from './SyncControls';
import { fixtureLyrics } from '../services/lyricsTestFixtures';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
const timedLyrics = fixtureLyrics({ timing: 'line', synced: [
  { time: 0, words: ['Synthetic zero'] }, { time: 2, words: ['Synthetic two'] }, { time: 5, words: ['Synthetic five'] },
] });
beforeEach(() => {
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: jest.fn().mockReturnValue({ matches: false }) });
});
afterEach(() => {
  act(() => root.unmount()); host.remove(); jest.restoreAllMocks();
  if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
  else Reflect.deleteProperty(window, 'matchMedia');
});

function click(text: string) {
  const button = Array.from(host.querySelectorAll('button')).find(item => item.textContent === text);
  if (!button) throw new Error(`Missing button: ${text}`);
  act(() => button.click());
}

function readerGeometry() {
  const container = host.querySelector<HTMLDivElement>('.lyrics__container')!;
  const line = host.querySelectorAll<HTMLDivElement>('.lyrics__line')[1];
  Object.defineProperty(container, 'clientHeight', { configurable: true, value: 200 });
  container.getBoundingClientRect = () => ({ top: 100, bottom: 300, height: 200 } as DOMRect);
  line.getBoundingClientRect = () => ({ top: 360, bottom: 408, height: 48 } as DOMRect);
  container.scrollTo = jest.fn(); line.scrollIntoView = jest.fn();
  return { container, line, scroll: container.scrollTo as jest.Mock };
}

it('renders genuine plain lyrics as escaped text without fabricated synchronized lines', () => {
  act(() => root.render(<Lyrics result={fixtureLyrics({ text: 'Synthetic first line\n<script>fixture</script>' })} progress={0} duration={0} paused />));
  expect(host.textContent).toContain('Synthetic first line\n<script>fixture</script>');
  expect(host.querySelector('script')).toBeNull();
  expect(host.querySelector('.lyrics__line--active')).toBeNull();
});

it('derives one active line at zero, across forward and backward seeks, and while paused', () => {
  const render = (progress: number, paused = false) => act(() => root.render(<Lyrics result={timedLyrics} progress={progress} duration={10000} paused={paused} />));
  for (const [progress, text, paused] of [[0, 'Synthetic zero', false], [6000, 'Synthetic five', false], [2500, 'Synthetic two', false], [2500, 'Synthetic two', true]] as const) {
    render(progress, paused);
    expect(host.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
    expect(host.querySelector('[aria-current="true"]')?.textContent).toBe(text);
  }
  expect(host.querySelector('.lyrics__word--current')).toBeNull();
});

it('selects real line boundaries exactly without inventing word timing', () => {
  for (const [progress, index] of [[-1, -1], [0, 0], [1999, 0], [2000, 1], [4999, 1], [5000, 2], [10000, 2]]) {
    expect(activeLineIndex(timedLyrics.synced, progress)).toBe(index);
  }
  expect(activeLineIndex([], 2000)).toBe(-1);
  expect(activeLineIndex(timedLyrics.synced, Number.NaN)).toBe(0);
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

it('offers an ordinal manual guide without a playback clock even when source timings exist', () => {
  act(() => root.render(<Lyrics result={timedLyrics} progress={9000} duration={10000} followsPlayback={false} paused />));
  expect(host.textContent).toContain('Guía manual · Sin audio');
  expect(host.textContent).toContain('Línea 1 de 3');
  expect(host.querySelector('[role="progressbar"]')).toBeNull();
  expect(host.querySelector('[data-line-time]')).toBeNull();
  expect(host.querySelector('[aria-current="true"]')?.textContent).toBe('Synthetic zero');
  expect(Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Anterior')?.disabled).toBe(true);
  click('Siguiente línea'); click('Siguiente línea');
  expect(host.textContent).toContain('Línea 3 de 3');
  expect(host.querySelector('[aria-current="true"]')?.textContent).toBe('Synthetic five');
  expect(Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Siguiente línea')?.disabled).toBe(true);
  click('Anterior');
  expect(host.textContent).toContain('Línea 2 de 3');
});

it('does not turn plain text into a timed or manual line guide', () => {
  act(() => root.render(<Lyrics result={fixtureLyrics()} progress={5000} duration={0} paused />));
  expect(host.querySelector('[aria-current]')).toBeNull();
  expect(host.querySelector('[data-line-time]')).toBeNull();
  expect(host.querySelector('[role="progressbar"]')).toBeNull();
  expect(host.textContent).not.toContain('Línea 1');
  expect(Array.from(host.querySelectorAll('button')).some(button => button.textContent === 'Siguiente línea')).toBe(false);
});

it.each([[false, 'smooth'], [true, 'auto']] as const)('scrolls only the reader and respects reduced motion (%s)', (reducedMotion, behavior) => {
  (window.matchMedia as jest.Mock).mockReturnValue({ matches: reducedMotion });
  act(() => root.render(<Lyrics result={timedLyrics} progress={0} duration={10000} paused={false} />));
  const { line, scroll } = readerGeometry();
  act(() => root.render(<Lyrics result={timedLyrics} progress={2000} duration={10000} paused={false} />));
  expect(scroll).toHaveBeenCalledWith({ top: 184, behavior });
  expect(line.scrollIntoView).not.toHaveBeenCalled();
  expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
});

it('lets manual scrolling suspend and explicitly resume playback following', () => {
  act(() => root.render(<Lyrics result={timedLyrics} progress={0} duration={10000} paused={false} />));
  const { container, scroll } = readerGeometry();
  act(() => container.dispatchEvent(new WheelEvent('wheel', { bubbles: true })));
  act(() => root.render(<Lyrics result={timedLyrics} progress={2000} duration={10000} paused={false} />));
  expect(scroll).not.toHaveBeenCalled();
  expect(host.querySelector('button[aria-pressed]')?.getAttribute('aria-pressed')).toBe('false');
  click('Seguir línea actual');
  expect(scroll).toHaveBeenCalledTimes(1);
});

it('preserves the real paused position without automatic scrolling', () => {
  act(() => root.render(<Lyrics result={timedLyrics} progress={0} duration={10000} paused />));
  const { scroll } = readerGeometry();
  act(() => root.render(<Lyrics result={timedLyrics} progress={2000} duration={10000} paused />));
  expect(host.querySelector('[aria-current="true"]')?.textContent).toBe('Synthetic two');
  expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('2000');
  expect(host.textContent).toContain('En pausa');
  expect(scroll).not.toHaveBeenCalled();
});

it('keeps offset adjustments signed and clamps their real millisecond values', () => {
  const adjust = jest.fn();
  const render = (adjustment: number) => act(() => root.render(<SyncControls adjustment={adjustment} onSyncAdjust={adjust} />));
  render(1000);
  expect(host.querySelector('output')?.textContent).toBe('+1,0 s');
  for (const [label, expected] of [['−0,5 s', 500], ['−0,1 s', 900], ['Restablecer', 0], ['+0,1 s', 1100], ['+0,5 s', 1500]] as const) {
    click(label); expect(adjust).toHaveBeenLastCalledWith(expected);
  }
  render(29900); click('+0,5 s'); expect(adjust).toHaveBeenLastCalledWith(30000);
  render(-29900); click('−0,5 s'); expect(adjust).toHaveBeenLastCalledWith(-30000);
  render(30000);
  expect(Array.from(host.querySelectorAll('button')).filter(button => button.textContent?.startsWith('+')).every(button => button.disabled)).toBe(true);
  render(-30000);
  expect(Array.from(host.querySelectorAll('button')).filter(button => button.textContent?.startsWith('−')).every(button => button.disabled)).toBe(true);
});
