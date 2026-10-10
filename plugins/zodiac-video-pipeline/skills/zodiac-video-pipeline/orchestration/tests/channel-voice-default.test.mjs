import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const docs=await Promise.all([
 new URL('../../references/character-viral-performance.md',import.meta.url),
 new URL('../phases/01-content.md',import.meta.url),
 new URL('../../SKILL.md',import.meta.url),
].map(u=>readFile(u,'utf8')));
test('channel defaults to sharp, confrontational, high-energy narration, not gentle',()=>{
 assert.match(docs[0],/TONE_GAT_DEFAULT/);
 assert.match(docs[0],/không tự động làm dịu/iu);
 assert.match(docs[1],/TONE_GAT_DEFAULT/);
 assert.match(docs[2],/TONE_GAT_DEFAULT/);
});
test('editorial voice remains evidence bounded and preserves already approved narration',()=>{
 assert.match(docs[0],/đặc điểm cung được kiểm chứng|evidence/i);
 assert.match(docs[1],/approved|đã duyệt/iu);
});
