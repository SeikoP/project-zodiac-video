import assert from 'node:assert/strict';
import test from 'node:test';
import {buildBlockedText, buildJobMessage} from '../apps/zodiac-studio/src/build-error.ts';

test('names the scene and the missing asset', () => {
  const out = buildBlockedText('VISUAL_BUILD_BLOCKED: Error: VISUAL_ASSET_MISSING s05-phone\n    at assert (file:///x.mjs:24:42)');
  assert.equal(out.summary, 'Cảnh s05 thiếu tài nguyên s05-phone');
  assert.match(out.detail, /VISUAL_ASSET_MISSING/);
});

test('uses the scene tag the compiler appends', () => {
  assert.equal(buildBlockedText('Error: VISUAL_LAYER_INVALID [scene s07]\n   at x').summary, 'Cảnh s07: thông số lớp (layer) không hợp lệ');
  assert.equal(buildBlockedText('Error: TRACE_STATE_BEFORE s02/s02-lean expected a got b [scene s02]').summary, 'Cảnh s02: thứ tự trạng thái của sự kiện không khớp');
  assert.equal(buildBlockedText('Error: VISUAL_TRANSITION_INVALID frames 3 for page-turn [scene s01]').summary, 'Cảnh s01: chuyển cảnh không hợp lệ');
});

test('unknown errors fall back to the first line, trimmed of the stack', () => {
  const out = buildBlockedText('Error: something odd happened\n    at a\n    at b');
  assert.equal(out.summary, 'something odd happened');
  assert.ok(!out.detail.includes('\n    at b') || out.detail.length < 700);
});

test('job messages are Vietnamese', () => {
  assert.equal(buildJobMessage('Build blocked; last good preview preserved'), 'Không dựng được; giữ bản xem trước tốt gần nhất.');
  assert.equal(buildJobMessage('Verified episode build ready'), 'Đã dựng xong và kiểm tra.');
  assert.equal(buildJobMessage('anything else'), 'anything else');
});
