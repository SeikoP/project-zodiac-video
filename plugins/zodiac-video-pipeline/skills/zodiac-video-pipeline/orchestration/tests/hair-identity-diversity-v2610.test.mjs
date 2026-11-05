import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {hairPaths} from '../../references/asset-library-v4/characters/geometry/hair-profiles.mjs';
import {validateCharacterDesignIntent} from '../../references/asset-library-v4/characters/character-design-intent.mjs';

const catalog=JSON.parse(await readFile(new URL('../../references/asset-library-v4/characters/components/catalog.json',import.meta.url),'utf8'));
const meaningful='This authored reason is intentionally long enough for validation.';
const design=(role='lead')=>({
  role,
  identity_tension:'Keeps emotional control while still revealing a readable social contrast.',
  audience_read:'The silhouette should be immediately distinguishable from the other visible cast.',
  selection_basis:'story_first',
  decision_reasons:{body_profile:meaningful,hair_id:meaningful,shirt_color_id:meaningful},
  rejected_alternative:{choice:'another-hair',reason:'The rejected option weakens silhouette contrast in this scene.'},
  scene_anchor:{scene_id:'S01',excerpt:'nhìn nhau',meaning:'The cast contrast must read at the relationship beat.'},
  state_purposes:{idle:'Carries the initial relationship tension before the visual payoff arrives.'},
  reuse_strategy:'native_assembly_after_story'
});
const production={version:'2.0',scenes:[{id:'S01',voice:'Hai người nhìn nhau rồi cùng im lặng.',entities:[
  {id:'a',kind:'character',initial_state:'idle',states:{idle:{}}},
  {id:'b',kind:'character',initial_state:'idle',states:{idle:{}}}
]}]};
const plan=(hairA='soft-layered-bob',hairB='side-braid')=>({format:'zodiac-character-assembly-plan@2',characters:[
  {entity_id:'a',body_profile:'lean_tall',hair_id:hairA,shirt_color_id:'teal',design_intent:design('lead')},
  {entity_id:'b',body_profile:'lanky_slouch',hair_id:hairB,shirt_color_id:'coral',design_intent:design('support')}
]});

test('fresh catalog has a substantially broader feminine hair silhouette pool',()=>{
  const preferred=(catalog.hair??[]).filter(row=>row.selection_tier==='preferred_meme').map(row=>row.id);
  assert.ok(preferred.length>=18,'fresh preferred hair pool must contain at least 18 silhouettes');
  for(const id of ['soft-layered-bob','shoulder-wave','loose-long-wave','side-braid','braided-ponytail','messy-top-bun','half-up-long','blunt-lob']){
    assert.ok(preferred.includes(id),id+' missing from preferred pool');
    assert.ok(Array.isArray(hairPaths(id))&&hairPaths(id).length>0,id+' missing native geometry');
  }
  assert.ok((catalog.casting_preferences?.lead_hair??[]).length>=10,'lead hair pool remains too narrow');
});

test('fresh v2 design intent requires explicit hair identity',()=>{
  const p=plan();delete p.characters[0].hair_id;
  assert.throws(()=>validateCharacterDesignIntent(production,p,{requireV2:true}),/CHARACTER_INTENT_HAIR_CHOICE_REQUIRED/);
});

test('co-visible cast cannot silently reuse the same hair silhouette',()=>{
  const p=plan('side-braid','side-braid');
  assert.throws(()=>validateCharacterDesignIntent(production,p,{requireV2:true}),/CHARACTER_HAIR_COLLISION/);
  p.characters[0].design_intent.hair_reuse_reason='The matching braid is an intentional sibling resemblance used by the relationship beat.';
  p.characters[1].design_intent.hair_reuse_reason='The matching braid is an intentional sibling resemblance used by the relationship beat.';
  assert.equal(validateCharacterDesignIntent(production,p,{requireV2:true}).character_count,2);
});
