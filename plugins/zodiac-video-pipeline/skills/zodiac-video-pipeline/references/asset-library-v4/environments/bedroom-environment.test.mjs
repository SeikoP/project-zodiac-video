import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const readJson=async rel=>JSON.parse(await readFile(path.join(here,rel),'utf8'));

test('bedroom uses one Study base plus clean/cozy/meme modifiers, never a full-scene background',async()=>{
  const index=await readJson('composition-index.json');
  assert.equal(index.format,'zodiac-bedroom-environment@1');
  assert.equal(index.policy.full_scene_backgrounds,false);
  assert.equal(index.canonical_profile,'bedroom-study-base');
  const base=index.profiles.find(x=>x.id==='bedroom-study-base');
  assert.ok(base); assert.equal(base.default_modifier,'clean');
  assert.deepEqual(Object.keys(base.modifiers).sort(),['clean','cozy-depth','meme-payoff'].sort());
  assert.ok(base.structural_roles.rear.length);assert.ok(base.structural_roles.grounding.length);
  assert.equal(base.modifiers['meme-payoff'].background_emphasis<=0.60,true);
  assert.equal(base.modifiers['meme-payoff'].payoff_only,true);
});

test('all bedroom structural cues are reusable v4 Human Stroke assets, not one bedroom canvas',async()=>{
  const index=await readJson('composition-index.json');
  for(const cue of index.structural_assets){
    assert.doesNotMatch(cue.id,/background|full-scene/i);
    await access(path.join(here,cue.path));
    const svg=await readFile(path.join(here,cue.path),'utf8');
    assert.match(svg,/style=zodiac-paper-doodle-meme-v4/);
    assert.match(svg,/handmade=human-stroke-v2/);
  }
});

test('bedroom composition validator passes the canonical contract',()=>{
  const validator=path.join(here,'validate-environment.mjs');
  const r=spawnSync(process.execPath,[validator],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/BEDROOM_ENVIRONMENT_PASS/);
});
