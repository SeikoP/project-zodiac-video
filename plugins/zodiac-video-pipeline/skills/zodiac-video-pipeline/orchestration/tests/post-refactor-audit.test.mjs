import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const orchestration=path.resolve(here,'..');
const skill=path.resolve(orchestration,'..');

test('fresh default Phase 2 context is scene-set first and does not auto-load extension catalogs',async()=>{
  const {loadStepContext}=await import('../plan-step-context.mjs');
  const state=JSON.parse(await readFile(path.join(orchestration,'pipeline-state.template.json'),'utf8'));
  const result=await loadStepContext('02-visual-production','visual_compile',state.flags);
  assert.ok(result.selected_capabilities.includes('scene_set'));
  for(const forbidden of [
    'references/asset-library-v4/environments/composition-index.json',
    'references/asset-library-v4/environments/compositions/index.json',
    'references/asset-library-v4/environments/README.md',
    'references/asset-library-v4/memes/templates/index.json',
    'references/asset-library-v4/memes/index.json',
    'references/asset-library-v4/compatibility/environment-profiles/index.json'
  ]){
    assert.equal(result.required_references.includes(forbidden),false,forbidden+' must be selected explicitly');
  }
});

test('Phase 3 production entrypoint is the canonical phase owner',async()=>{
  const manifest=JSON.parse(await readFile(path.join(orchestration,'phases/03-handoff.json'),'utf8'));
  assert.equal(manifest.production_entrypoint,'phases/phase03/run-phase03-production.mjs');
});

test('Phase 2 snapshot restore resolves the core release owner after executable refactor',async()=>{
  const source=await readFile(path.join(skill,'phases/phase02/phase02-execute.mjs'),'utf8');
  assert.doesNotMatch(source,/path\.join\(HERE,'restore-plugin-source\.mjs'\)/u);
  assert.match(source,/core\/release\/restore-plugin-source\.mjs/u);
});

test('Phase 2 fallback fingerprint scans executable owner roots, not only orchestration wrappers',async()=>{
  const source=await readFile(path.join(skill,'phases/phase02/phase02-execute.mjs'),'utf8');
  assert.match(source,/for\(const ownerRoot of \['core','features','phases','bootstrap','art-direction'\]\)await walk\(path\.join\(base,ownerRoot\)\);/u);
  assert.match(source,/await walk\(path\.join\(base,'orchestration'\)\);/u);
});

test('selection guide does not instruct fresh unbound context to load the legacy complete list',async()=>{
  const guide=await readFile(path.join(skill,'references/asset-library-v4/selection-guide.md'),'utf8');
  assert.doesNotMatch(guide,/With no selection bound, retain the legacy complete reference list\./u);
});