import assert from 'node:assert/strict';
import test from 'node:test';
import {approvalNoteText} from '../apps/zodiac-studio/src/voice-approval.ts';

const units = [{id: 'U1'}, {id: 'U2'}, {id: 'U3'}];

test('names the reason and the 1-based unit number', () => {
  assert.equal(approvalNoteText({units, approval_note: {reason: 'pause_changed', unit_ids: ['U2'], at: 1}}), 'Cần nghe lại vì đã đổi khoảng nghỉ (đoạn 2).');
  assert.equal(approvalNoteText({units, approval_note: {reason: 'take_changed', unit_ids: ['U1', 'U3'], at: 1}}), 'Cần nghe lại vì đã đổi take (đoạn 1, 3).');
});

test('says nothing when no approval was dropped', () => {
  assert.equal(approvalNoteText({units, approval_note: null}), null);
  assert.equal(approvalNoteText(null), null);
});
