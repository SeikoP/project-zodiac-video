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
 const input={format:'zodiac-visual-intent@1',taxonomy_version:'narrative_visual@1',narration_sha256:createHash('sha256').update(voice).digest('hex'),video:{width:1080,height:1920,fps:24},visual_system:{},cast:[],frames:[],assets:{window:{category:'scene_accent',path:'assets/environment/cafe-window.svg'}},narrative_visual_decision:{mode:'omitted',reason:'No symbolic visual needed',review_ref:'review:accent'},scenes:[{id:'S01',narration_range:[0,Buffer.byteLength(voice)],semantic_goal:'A cafe setting',grammar:{frame_id:'prop-focus',mechanic_id:'reveal',bindings:{focus_prop:'window'},environment:{background_palette_id:'warm-paper'}},entities:[{id:'window',kind:'scene_accent',visual_role:'scene_accent',initial_state:'shown',states:{shown:{asset:'window',visible:true,transform:{x:90,y:100,width:290,height:340}}}}],events:[],director_beats:[],art_direction:{},semantic_asset_decisions:[]}]};
 const output=compileVisualIntent(input,{narration:voice});
 assert.equal(output.production.assets.window.category,'environment');
 assert.equal(output.production.scenes[0].entities[0].visual_role,'background');
 assert.equal(output.production.scenes[0].environment.mode,'canvas');
 assert.equal(output.art_direction.scenes[0].components[0].narrative_role,'scene_accent');
});

test('legacy Story Text decisions project their reason and spoken event anchor into Art Direction',async()=>{
 const {compileVisualIntent}=await import('../../features/visual-composition/compile-visual-intent.mjs');
 const {createHash}=await import('node:crypto');
 const voice='Mọi thứ vẫn nối với nhau.';
 const input={format:'zodiac-visual-intent@1',taxonomy_version:'narrative_visual@1',narration_sha256:createHash('sha256').update(voice).digest('hex'),video:{width:1080,height:1920,fps:24},visual_system:{},cast:[],frames:[],assets:{label:{category:'overlay',path:'assets/overlays/label.svg'}},narrative_visual_decision:{mode:'omitted',reason:'No symbolic visual needed',review_ref:'review:story-text'},scenes:[{id:'S01',narration_range:[0,Buffer.byteLength(voice)],semantic_goal:'Show a claim then its correction',grammar:{frame_id:'prop-focus',mechanic_id:'reveal',bindings:{focus_prop:'story_text_s01'},environment:{background_palette_id:'warm-paper'}},entities:[{id:'story_text_s01',kind:'object',visual_role:'overlay',initial_state:'hidden',states:{hidden:{asset:'label',visible:false,layer:42,transform:{x:120,y:170,width:840,height:235}},setup:{asset:'label',visible:true,layer:42,transform:{x:120,y:170,width:840,height:235}}},story_text:{purpose:'contrast',reason:'Show the claim before the spoken correction.',states:{setup:'VẪN NỐI'}}}],events:[{id:'TEXT_SETUP',target:'story_text_s01',action:'state_swap',state_before:'hidden',state_after:'setup',scheduling:{mode:'voice_anchor'},trigger:{type:'voice_anchor',text:'Mọi thứ vẫn nối',occurrence:1},motion:{preset:'state_swap',duration_frames:12}}],director_beats:[],art_direction:{},semantic_asset_decisions:[]}]};
 const output=compileVisualIntent(input,{narration:voice}),component=output.art_direction.scenes[0].components[0];
 assert.equal(component.reason,input.scenes[0].entities[0].story_text.reason);
 assert.equal(component.voice_anchor,'Mọi thứ vẫn nối');
 assert.equal(output.production.scenes[0].entities[0].story_text,undefined);
 assert.deepEqual(output.production.scenes[0].events[0].scheduling,{max_drift_frames:0,merge_policy:'never'});
 const schema=JSON.parse(await readFile(new URL('../../references/contracts/authoring-ir-v1.schema.json',import.meta.url)));
 const handoff=compileJobV5(output.production,design,{sign:'Test',concept:'story-text',contractSchema:schema});
 assert.deepEqual(handoff.ir.scenes[0].events[0].scheduling,{max_drift_frames:0,merge_policy:'never'});
});
