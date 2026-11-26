/**
 * A steady playhead for video that is driven by an <audio> element.
 *
 * `audio.currentTime` advances in coarse, uneven steps, so painting straight from it makes motion judder. The clock runs on
 * the frame timer and only follows the audio when the two drift apart by more than `tolerance` ms (a seek, a stall, buffering).
 */
export function createPlaybackClock(startMs: number, readAudioMs: (() => number | null) | null, nowMs: number, tolerance = 150) {
  let base = startMs, origin = nowMs;
  return {
    at(now: number): number {
      const predicted = base + (now - origin);
      const heard = readAudioMs ? readAudioMs() : null;
      if (heard !== null && Number.isFinite(heard) && Math.abs(heard - predicted) > tolerance) { base = heard; origin = now; return base; }
      return predicted;
    },
    reset(ms: number, now: number) { base = ms; origin = now; },
  };
}
