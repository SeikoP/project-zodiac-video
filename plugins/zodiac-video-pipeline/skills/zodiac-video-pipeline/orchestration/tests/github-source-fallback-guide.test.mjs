import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
test('GitHub transport fallback requires version+integrity and does not certify failed CI',async()=>{
 const t=await readFile(new URL('execution-bootstrap.md',root),'utf8');
 for(const phrase of ['phase-scoped','SeikoP/project-zodiac-video','plugin version/release lineage','SHA-256','SOURCE_INTEGRITY_MISMATCH','SOURCE_TRANSPORT_UNAVAILABLE'])assert.ok(t.includes(phrase),phrase);
});
test('skill references exact optional fallback',async()=>{
 const s=await readFile(new URL('../SKILL.md',root),'utf8');
 assert.ok(s.includes('phase-scoped execution bundle'));
});
