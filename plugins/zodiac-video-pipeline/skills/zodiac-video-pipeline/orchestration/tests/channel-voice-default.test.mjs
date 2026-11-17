import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const performance=await readFile(new URL('../../references/character-viral-performance.md',import.meta.url),'utf8');
const phase1=await readFile(new URL('../phases/01-content.md',import.meta.url),'utf8');
const skill=await readFile(new URL('../../SKILL.md',import.meta.url),'utf8');

test('channel follows semantic beat rhythm without mandatory intensity',()=>{
 assert.match(performance,/TONE_RHYTHM_DEFAULT/);
 assert.match(performance,/no fixed intensity/);
 assert.match(phase1,/rhythm/iu);
 assert.match(phase1,/no fixed fictional-ad requirement and no fixed duration band/iu);
 assert.match(skill,/references\/phase01-briefing\.md/);
});

test('editorial voice remains evidence bounded and preserves approved narration',()=>{
 assert.match(performance,/evidence/iu);
 assert.match(phase1,/approved|đã duyệt/iu);
});
