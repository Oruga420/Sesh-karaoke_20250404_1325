// Shared LRC utility; only HTTP handlers belong in Vercel's api directory.
// Standard line times only. Word timing is never inferred from plain text.
const TIME_TAG = /^\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/;

function parseLrc(lrcText) {
  if (typeof lrcText !== 'string' || !lrcText) return [];
  const lines = lrcText.split(/\r?\n/);
  let offset = 0;
  for (const line of lines) {
    const match = line.trim().match(/^\[offset:([+-]?\d+)\]$/i);
    if (match && Number.isSafeInteger(Number(match[1]))) offset = Number(match[1]) / 1000;
  }
  const result = [];
  for (const rawLine of lines) {
    let remaining = rawLine.trim();
    const times = [];
    let tag;
    while ((tag = remaining.match(TIME_TAG))) {
      if (Number(tag[2]) >= 60) { times.length = 0; break; }
      const fraction = tag[3] ? Number(tag[3]) / (10 ** tag[3].length) : 0;
      times.push(Math.max(0, Number(tag[1]) * 60 + Number(tag[2]) + fraction + offset));
      remaining = remaining.slice(tag[0].length);
    }
    if (!times.length || /^\[\d/.test(remaining)) continue;
    const words = remaining.trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    for (const time of times) result.push({ time, words: [...words] });
  }
  result.sort((left, right) => left.time - right.time);
  return result;
}

module.exports = { parseLrc };
