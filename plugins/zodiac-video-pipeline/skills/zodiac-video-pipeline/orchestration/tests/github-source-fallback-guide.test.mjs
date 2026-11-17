import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);

test('Web does not depend on repository transport and Local owns verified native source',async()=>{
 const t=await readFile(new URL('execution-bootstrap.md',root),'utf8');
 assert.match(t,/No execution bootstrap is required/iu);
 assert.match(t,/checked-out repository or the verified Local execution source/iu);
 assert.match(t,/Source transport never creates creative approval/iu);
 assert.doesNotMatch(t,/SeikoP\/project-zodiac-video/);
});

test('top-level skill keeps execution-source integrity separate from editorial authority',async()=>{
 const s=await readFile(new URL('../SKILL.md',root),'utf8');
 assert.match(s,/Pin commit\/version and verify SHA-256/iu);
 assert.match(s,/Transport never changes editorial authority/iu);
});
