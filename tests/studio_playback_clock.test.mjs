import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlaybackClock } from '../apps/zodiac-studio/src/playback-clock.ts';

test('the clock advances with the frame timer, not with the audio steps', () => {
  let audio = 1000;
  const clock = createPlaybackClock(1000, () => audio, 0);
  const seen = [];
  for (let now = 16; now <= 160; now += 16) { audio = 1000 + Math.floor(now / 50) * 50; seen.push(clock.at(now)); } // audio moves in 50 ms jumps
  const steps = seen.map((v, i) => i ? v - seen[i - 1] : v - 1000);
  assert.ok(steps.every(s => Math.abs(s - 16) < 1e-9), `uniform 16 ms steps, got ${steps}`);
});

test('a real drift (seek or stall) pulls the clock back to the audio', () => {
  let audio = 1000;
  const clock = createPlaybackClock(1000, () => audio, 0);
  clock.at(16);
  audio = 5000;  // the user scrubbed
  assert.equal(clock.at(32), 5000);
  assert.equal(clock.at(48), 5016);
});

test('without audio the clock is just elapsed time', () => {
  const clock = createPlaybackClock(250, null, 100);
  assert.equal(clock.at(300), 450);
});
