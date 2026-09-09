/**
 * Parse "MM:SS" or "H:MM:SS" into seconds for demo timeline jumps.
 * @param {string} label
 * @returns {number}
 */
export function parseMmSsToSeconds(label) {
  const s = String(label || '').trim();
  if (!s) return NaN;
  const parts = s.split(':').map((p) => Number.parseInt(p, 10));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return NaN;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return NaN;
}

/**
 * Longest prefix of events (scenario order) whose timestamps are all at least `lagSec`
 * behind `videoSeconds` — used to reveal timeline rows as playback catches up.
 * @param {{ time?: string, timeLabel?: string }[]} events
 * @param {number} videoSeconds
 * @param {number} lagSec
 * @returns {number}
 */
export function countTimelineEventsUnlocked(events, videoSeconds, lagSec) {
  if (!Array.isArray(events) || !Number.isFinite(videoSeconds) || !Number.isFinite(lagSec)) return 0;
  let k = 0;
  for (const ev of events) {
    const ts = parseMmSsToSeconds(ev?.time ?? ev?.timeLabel ?? '');
    if (!Number.isFinite(ts)) break;
    if (videoSeconds >= ts + lagSec) k += 1;
    else break;
  }
  return k;
}
