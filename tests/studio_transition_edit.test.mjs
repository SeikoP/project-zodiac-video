import assert from 'node:assert/strict';
import test from 'node:test';
import {withTransition, withTransitionEverywhere, TRANSITION_PRESETS, transitionLabel} from '../apps/zodiac-studio/src/scene/transition-edit.ts';

const intent = () => ({format: 'x', scenes: [{id: 's1'}, {id: 's2', transition: {preset: 'cut', frames: 0}}, {id: 's3'}]});

test('sets one scene and leaves the others untouched, without mutating the input', () => {
  const before = intent();
  const next = withTransition(before, 's1', {preset: 'paper-slide', frames: 9});
  assert.deepEqual(next.scenes[0].transition, {preset: 'paper-slide', frames: 9});
  assert.deepEqual(next.scenes[1], before.scenes[1]);
  assert.equal(before.scenes[0].transition, undefined);
});

test('frames are clamped into the preset range and a cut has zero frames', () => {
  assert.deepEqual(withTransition(intent(), 's1', {preset: 'page-turn', frames: 99}).scenes[0].transition, {preset: 'page-turn', frames: 24});
  assert.deepEqual(withTransition(intent(), 's1', {preset: 'page-turn', frames: 1}).scenes[0].transition, {preset: 'page-turn', frames: 9});
  assert.deepEqual(withTransition(intent(), 's1', {preset: 'cut', frames: 12}).scenes[0].transition, {preset: 'cut', frames: 0});
});

test('apply to every scene skips the last one (it has no boundary after it)', () => {
  const next = withTransitionEverywhere(intent(), {preset: 'page-turn', frames: 12});
  assert.deepEqual(next.scenes.map((s) => s.transition?.preset), ['page-turn', 'page-turn', undefined]);
});

test('unknown scene is rejected and labels are Vietnamese', () => {
  assert.throws(() => withTransition(intent(), 'nope', {preset: 'cut', frames: 0}), /nope/);
  assert.deepEqual(Object.keys(TRANSITION_PRESETS), ['cut', 'paper-slide', 'page-turn']);
  assert.equal(transitionLabel('page-turn'), 'Lật trang');
  assert.equal(transitionLabel(undefined), 'Lật trang (mặc định)');
});
