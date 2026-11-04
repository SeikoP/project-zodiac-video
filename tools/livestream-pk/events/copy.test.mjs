import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ABILITY_IDS, describeAbility } from './abilities.mjs';

// Nothing on screen may ask for a gift or hint at one. The exception list stays empty.
// events/abilities.mjs is scanned here; public/overlay.js and public/host-prompts.js join the scan when the overlay is rebuilt.
export const FORBIDDEN = /tặng quà|gửi quà|donate|ủng hộ|mua |xu để|xin quà/i;
const EXCEPTIONS = [];

// every quoted string literal of a source file (comments are not on screen)
const literals = file => [...readFileSync(new URL(file, import.meta.url), 'utf8').matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map(m => m[1] ?? m[2] ?? m[3]);

test('the forbidden pattern catches what it should', () => {
  for (const bad of ['Tặng quà đi', 'gửi quà cho mình', 'Donate nhé', 'ủng hộ mình', 'mua xu', 'cần xu để thắng', 'xin quà']) assert.match(bad, FORBIDDEN, bad);
  for (const ok of ['Đòn tuyệt kỹ!', 'Rương vàng!', 'Trăng đầy!', 'Phá băng!']) assert.doesNotMatch(ok, FORBIDDEN, ok);
});

test('every ability banner is free of gift-asking words', () => {
  let seen = 0;
  for (const [event, tiers] of Object.entries(ABILITY_IDS)) {
    for (const tier of Object.keys(tiers)) {
      const text = describeAbility(event, tier);
      assert.ok(text, `${event}/${tier} has a banner`);
      assert.doesNotMatch(text, FORBIDDEN, `${event}/${tier}`);
      seen++;
    }
  }
  assert.ok(seen >= 15);
});

test('no string in events/abilities.mjs asks for or hints at gifts', () => {
  const strings = literals('./abilities.mjs');
  assert.ok(strings.length > 20, 'the scan found the strings');
  for (const s of strings) if (!EXCEPTIONS.includes(s)) assert.doesNotMatch(s, FORBIDDEN, s);
});
