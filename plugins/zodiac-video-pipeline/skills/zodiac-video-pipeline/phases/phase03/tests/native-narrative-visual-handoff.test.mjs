import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
test('Job5 keeps story_object only as Narrative Visual transport vocabulary',async()=>{
 const compiler=await readFile(path.join(skill,'phases/phase03/compile-job-v5.mjs'),'utf8');
 assert.match(compiler,/value==='narrative_visual'\?'story_object'/u);
 assert.doesNotMatch(compiler,/story_symbol|visual_metaphor/u);
});
test('Phase3 no longer loads a separate Story Object authoring feature',async()=>{
 for(const rel of ['phases/phase03/run-phase03-production.mjs','phases/phase03/phase03-production-release.mjs']){
  const source=await readFile(path.join(skill,rel),'utf8');
  assert.doesNotMatch(source,/features\/story-object|story-object-plan|story-object-required/u,rel);
 }
});
