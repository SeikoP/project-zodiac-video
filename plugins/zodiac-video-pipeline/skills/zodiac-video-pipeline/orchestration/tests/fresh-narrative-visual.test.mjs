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
 assert.deepEqual(coverageLayers,['actors','scene_accent','narrative_visual','props','support','caption']);
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

test('canvas-native accents project as rear environment without prop/effect density',async()=>{
 const {compileVisualIntent}=await import('../../features/visual-composition/compile-visual-intent.mjs');
 const {createHash}=await import('node:crypto');
 const voice='Quán cà phê có cửa sổ.';
 const input={format:'zodiac-visual-intent@1',taxonomy_version:'narrative_visual@1',narration_sha256:createHash('sha256').update(voice).digest('hex'),video:{width:1080,height:1920,fps:24},visual_system:{},cast:[],frames:[],assets:{window:{category:'scene_accent',path:'assets/environment/cafe-window.svg'}},narrative_visual_decision:{mode:'omitted',reason:'No symbolic visual needed',review_ref:'review:accent'},scenes:[{id:'S01',narration_range:[0,Buffer.byteLength(voice)],semantic_goal:'A cafe setting',grammar:{environment:{background_palette_id:'warm-paper'}},entities:[{id:'window',kind:'scene_accent',visual_role:'scene_accent',initial_state:'shown',states:{shown:{asset:'window',visible:true,transform:{x:90,y:100,width:290,height:340}}}}],events:[],director_beats:[],art_direction:{},semantic_asset_decisions:[]}]};
 const output=compileVisualIntent(input,{narration:voice});
 assert.equal(output.production.assets.window.category,'environment');
 assert.equal(output.production.scenes[0].entities[0].visual_role,'background');
 assert.equal(output.production.scenes[0].environment.mode,'canvas');
 assert.equal(output.art_direction.scenes[0].components[0].narrative_role,'scene_accent');
});
