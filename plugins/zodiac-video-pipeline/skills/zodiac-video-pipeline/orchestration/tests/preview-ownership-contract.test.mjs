import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const text=async p=>readFile(path.join(root,p),'utf8');
test('producer review requires source-backed two endpoints/event, not Remotion',async()=>{
 const skill=await text('SKILL.md'),router=await text('orchestration/router.md'),guide=await text('orchestration/phases/02-visual-production.md');
 for(const s of [skill,router,guide]){
  assert.match(s,/build-native-preview-pairs\.mjs/);
  assert.match(s,/validate-native-preview-pairs\.mjs/);
 }
 assert.match(skill,/Remotion.*local runner|local runner.*Remotion/s);
 assert.match(router,/two authored endpoints per event/i);
});
test('version synchronized between plugin manifest and template',async()=>{
 const pkg=JSON.parse(await readFile(path.resolve(root,'../../plugin.json'),'utf8')); // plugin root is three dirs above skill root, checked below
 const state=JSON.parse(await text('orchestration/pipeline-state.template.json'));
 assert.equal(state.plugin_version,pkg.version);
});
