import assert from 'node:assert/strict';
import test from 'node:test';
import {approvalNoteText, listenHintText} from '../apps/zodiac-studio/src/voice-approval.ts';

const units = [{id: 'U1'}, {id: 'U2'}, {id: 'U3'}];

test('names the reason and the 1-based unit number', () => {
  assert.equal(approvalNoteText({units, approval_note: {reason: 'pause_changed', unit_ids: ['U2'], at: 1}}), 'Cần nghe lại vì đã đổi khoảng nghỉ (đoạn 2).');
  assert.equal(approvalNoteText({units, approval_note: {reason: 'take_changed', unit_ids: ['U1', 'U3'], at: 1}}), 'Cần nghe lại vì đã đổi take (đoạn 1, 3).');
});

test('asks for only the changed segments, not the whole episode', () => {
  assert.equal(listenHintText({units, segments_needing_listen: ['U2']}), 'Chỉ cần nghe lại đoạn 2 ở tab “Từng đoạn”, rồi ghép audio lại.');
  assert.equal(listenHintText({units, segments_needing_listen: ['U1', 'U3']}), 'Chỉ cần nghe lại đoạn 1, 3 ở tab “Từng đoạn”, rồi ghép audio lại.');
});

test('no segment hint when everything or nothing needs listening', () => {
  assert.equal(listenHintText({units, segments_needing_listen: []}), null);
  assert.equal(listenHintText({units, segments_needing_listen: ['U1', 'U2', 'U3']}), null);
  assert.equal(listenHintText(null), null);
});

test('says nothing when no approval was dropped', () => {
  assert.equal(approvalNoteText({units, approval_note: null}), null);
  assert.equal(approvalNoteText(null), null);
});
