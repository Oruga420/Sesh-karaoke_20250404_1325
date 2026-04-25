// Tests for the LRC parser used by api/lyrics.js.
// Placed under src/ so CRA's Jest picks it up via `npm test`.
export {};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parseLrc } = require('../../api/lrcParser');

interface SyncedLine {
  time: number;
  words: string[];
}

describe('parseLrc', () => {
  describe('input validation', () => {
    it('returns [] for empty string', () => {
      expect(parseLrc('')).toEqual([]);
    });

    it('returns [] for null', () => {
      expect(parseLrc(null)).toEqual([]);
    });

    it('returns [] for undefined', () => {
      expect(parseLrc(undefined)).toEqual([]);
    });

    it('returns [] for non-string input', () => {
      expect(parseLrc(123 as any)).toEqual([]);
      expect(parseLrc({} as any)).toEqual([]);
    });
  });

  describe('timestamp parsing', () => {
    it('parses a single line with 2-digit fraction (hundredths)', () => {
      const result: SyncedLine[] = parseLrc('[00:12.34]Hello world');
      expect(result).toHaveLength(1);
      expect(result[0].time).toBeCloseTo(12.34, 5);
      expect(result[0].words).toEqual(['Hello', 'world']);
    });

    it('parses 3-digit fraction (milliseconds)', () => {
      const result = parseLrc('[00:12.345]Hello');
      expect(result[0].time).toBeCloseTo(12.345, 5);
    });

    it('parses 1-digit fraction (tenths)', () => {
      const result = parseLrc('[00:12.5]Hello');
      expect(result[0].time).toBeCloseTo(12.5, 5);
    });

    it('parses timestamps with no fraction', () => {
      const result = parseLrc('[01:30]Plain seconds');
      expect(result[0].time).toBe(90);
    });

    it('accepts colon as fraction separator (rare LRC variant)', () => {
      const result = parseLrc('[00:12:50]Colon variant');
      expect(result[0].time).toBeCloseTo(12.5, 5);
    });

    it('handles multi-minute timestamps', () => {
      const result = parseLrc('[12:34.56]Twelve minutes');
      expect(result[0].time).toBeCloseTo(12 * 60 + 34.56, 5);
    });
  });

  describe('multi-line input', () => {
    it('parses multiple lines in order', () => {
      const lrc = ['[00:01.00]First', '[00:02.00]Second', '[00:03.00]Third'].join('\n');
      const result = parseLrc(lrc);
      expect(result.map((l: SyncedLine) => l.words.join(' '))).toEqual(['First', 'Second', 'Third']);
    });

    it('sorts out-of-order timestamps ascending by time', () => {
      const lrc = ['[00:05.00]Five', '[00:01.00]One', '[00:03.00]Three'].join('\n');
      const result = parseLrc(lrc);
      expect(result.map((l: SyncedLine) => l.time)).toEqual([1, 3, 5]);
    });

    it('handles \\r\\n (Windows) line endings', () => {
      const result = parseLrc('[00:01.00]A\r\n[00:02.00]B');
      expect(result).toHaveLength(2);
    });
  });

  describe('skipping malformed and empty content', () => {
    it('skips lines without a timestamp', () => {
      const lrc = ['Free text line', '[00:01.00]Real lyric', 'another bare line'].join('\n');
      const result = parseLrc(lrc);
      expect(result).toHaveLength(1);
      expect(result[0].words).toEqual(['Real', 'lyric']);
    });

    it('skips metadata tags like [ar: artist] [length: 03:45]', () => {
      // [ar: ...] starts with letters, not digits — must not match
      const lrc = ['[ar: Some Artist]', '[ti: Some Title]', '[length: 03:45]', '[00:01.00]Real'].join('\n');
      const result = parseLrc(lrc);
      expect(result).toHaveLength(1);
      expect(result[0].words).toEqual(['Real']);
    });

    it('skips lines with timestamp but empty content', () => {
      const lrc = ['[00:01.00]', '[00:02.00]   ', '[00:03.00]Real'].join('\n');
      const result = parseLrc(lrc);
      expect(result).toHaveLength(1);
      expect(result[0].words).toEqual(['Real']);
    });

    it('skips blank lines silently', () => {
      const lrc = ['', '[00:01.00]A', '', '[00:02.00]B', ''].join('\n');
      const result = parseLrc(lrc);
      expect(result).toHaveLength(2);
    });
  });

  describe('content normalization', () => {
    it('trims content and collapses whitespace into single-word tokens', () => {
      const result = parseLrc('[00:01.00]   hello    world   ');
      expect(result[0].words).toEqual(['hello', 'world']);
    });

    it('preserves punctuation inside words', () => {
      const result = parseLrc("[00:01.00]Don't stop, believin'");
      expect(result[0].words).toEqual(["Don't", 'stop,', "believin'"]);
    });
  });
});
