// LRC (LyRiCs) timestamp parser.
//
// Input: standard LRC text where each line begins with a [mm:ss.xx] tag,
// e.g. "[00:12.34]Hello world\n[01:05.50]Another line".
//
// Output: an array of { time: number (seconds), words: string[] } sorted
// ascending by time. Malformed lines, metadata tags ([ar: ...]), and lines
// with no content after the timestamp are skipped.

// [mm:ss(.xx|:xx)?]content — fraction is optional, separator can be . or :
const LINE_REGEX = /^\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\](.*)$/;

/**
 * @typedef {Object} SyncedLine
 * @property {number} time   Time in seconds
 * @property {string[]} words Words tokenized from the line content
 */

/**
 * @param {string} lrcText
 * @returns {SyncedLine[]}
 */
function parseLrc(lrcText) {
  if (typeof lrcText !== 'string' || lrcText.length === 0) return [];

  const result = [];

  for (const rawLine of lrcText.split(/\r?\n/)) {
    const match = rawLine.match(LINE_REGEX);
    if (!match) continue;

    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const fractionRaw = match[3];

    let fraction = 0;
    if (fractionRaw && fractionRaw.length > 0) {
      const divisor = Math.pow(10, fractionRaw.length);
      fraction = parseInt(fractionRaw, 10) / divisor;
    }
    const timeSec = minutes * 60 + seconds + fraction;

    const content = match[4].trim();
    if (!content) continue;

    const words = content.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) continue;

    result.push({ time: timeSec, words });
  }

  result.sort((a, b) => a.time - b.time);
  return result;
}

module.exports = { parseLrc };
