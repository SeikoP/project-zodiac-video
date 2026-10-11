import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
const src=async(relative)=>readFile(new URL(relative,import.meta.url),'utf8');
test('producer and local-runner review scopes are explicit',async()=>{
 const skill=await src('../../SKILL.md'),router=await src('../router.md'),bootstrap=await src('../execution-bootstrap.md'),guide=await src('../phases/02-visual-production.md');
 for(const content of [skill,router,bootstrap,guide]){
   assert.match(content,/Phase[-\s]+0?2/i);
   assert.match(content,/local runner/i);
   assert.match(content,/Remotion/i);
 }
 assert.match(router,/without.*Remotion/s);
 assert.match(bootstrap,/do not.*demand.*Remotion/is);
 assert.match(guide,/explicit human approval completes this visual-design gate/);
 assert.doesNotMatch(router,/provide renderer-faithful preview and secure human approval/);
 assert.doesNotMatch(bootstrap,/renderer-faithful preview and explicit human approval before/);
});
test('Phase 02 native gates are preserved, without a Remotion gate',async()=>{
 const router=await src('../router.md'),skill=await src('../../SKILL.md');
 for(const term of ['Character State Asset Planning','Environment Compile','Scene Direction','Visual Quality']) {
   assert.ok(router.includes(term),`native requirement missing: ${term}`);
 }
 assert.match(skill,/native V4 assets/);
 assert.match(router,/Phase-02 Visual Review/);
 assert.match(router,/Remotion preview is a \*\*local runner\*\* responsibility/);
});
test('Job@5 export is Phase 03 only; no extra phase',async()=>{
 const router=await src('../router.md');
 assert.match(router,/01-content.*02-visual-production.*03-handoff/s);
 assert.match(router,/Phase 3 converts the approved Phase-2 authoring payload/);
 assert.match(router,/local_runner_import_ready|LOCAL_RUNNER_IMPORT_READY/);
 const t=JSON.parse(await src('../pipeline-state.template.json'));assert.match(t.plugin_version,/^2\.\d+\.\d+$/);
});
