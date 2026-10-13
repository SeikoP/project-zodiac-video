import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFreshAssetSelection} from '../../features/visual-composition/validate-fresh-asset-selection.mjs';
import {coverageLayers,legacyCoverageLayers} from '../../features/visual-composition/validate-visual-coverage.mjs';
import {compileJobV5} from '../../phases/phase03/compile-job-v5.mjs';
import {design} from './handoff-fixture.mjs';
import {readFile} from 'node:fs/promises';

test('fresh canvas authoring does not require a scene set or accent',()=>{
 const result=validateFreshAssetSelection({intent:{scenes:[{id:'S01',environment:{}}]},production:{assets:{}},policy:{retired_asset_ids:[],retired_hair_ids:[],extensions:[]}});
 assert.equal(result.status,'PASS');
});
test('fresh coverage excludes scene-set and scene-accent; legacy layers retained',()=>{
 assert.deepEqual(coverageLayers,['actors','narrative_visual','props','support','caption']);
 assert.ok(legacyCoverageLayers.includes('scene_set'));
});
test('narrative visual projects to existing Job5 story_object role without schema change',async()=>{
 const schema=JSON.parse(await readFile(new URL('../../references/contracts/authoring-ir-v1.schema.json',import.meta.url)));
 const source={version:'2.0',video:{width:1080,height:1920,fps:24},assets:{
  scale:{category:'narrative_visual',path:'assets/story/libra-scale.svg'}
 },scenes:[{id:'S01',voice:'Thiên Bình nhìn về hai phía.',entities:[{
  id:'balance',kind:'narrative_visual',visual_role:'narrative_visual',initial_state:'center',
  states:{
   center:{asset:'scale',visible:true,transform:{x:360,y:100,width:360,height:230}},
   left:{asset:'scale',visible:true,transform:{x:360,y:100,width:360,height:230,rotation:-12}},
   right:{asset:'scale',visible:true,transform:{x:360,y:100,width:360,height:230,rotation:12}}
  }}],events:[]}]};
 const result=compileJobV5(source,design,{sign:'Thien Binh',concept:'balance',contractSchema:schema});
 assert.equal(result.ir.assets.scale.category,'story_object');
 assert.equal(result.ir.scenes[0].entities[0].visual_role,'story_object');
 assert.equal(source.assets.scale.category,'narrative_visual');
 assert.equal(result.manifest.contract.id,'zodiac-authoring-ir');
});
