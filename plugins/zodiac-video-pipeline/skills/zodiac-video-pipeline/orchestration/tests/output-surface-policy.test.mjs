import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFile(path.join(root,p),'utf8');
test('Phase 1 and Phase 2 expose no ZIP operation while Phase 3 owns one ZIP',async()=>{
 const p1=JSON.parse(await read('phases/01-content.json')),p2=JSON.parse(await read('phases/02-visual-production.json')),p3=JSON.parse(await read('phases/03-handoff.json'));
 for(const p of [p1,p2])for(const s of p.steps)assert.ok(!(s.allowed_operations??[]).includes('create_zip'),p.id+'/'+s.id);
 const exporters=p3.steps.filter(s=>(s.allowed_operations??[]).includes('create_zip'));
 assert.equal(exporters.length,1);assert.equal(exporters[0].max_zip_outputs,1);
});
test('user guidance states review-first output surfaces and Phase 3-only ZIP',async()=>{
 const skill=await read('../SKILL.md');
 assert.match(skill,/Phase 01[^\n]*no user-facing ZIP/iu);
 assert.match(skill,/Phase 02[^\n]*no user-facing ZIP/iu);
 assert.match(skill,/Phase 03[^\n]*exactly one validated Job@5 ZIP/iu);
});
