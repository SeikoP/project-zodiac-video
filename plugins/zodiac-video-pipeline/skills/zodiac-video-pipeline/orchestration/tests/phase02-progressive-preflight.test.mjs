import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProgressivePreflight} from '../../features/visual-composition/validate-phase02-progressive-preflight.mjs';

const registry={motions:{state_swap:{default_duration_frames:12}}};
const token={id:'zodiac-paper-doodle-meme-v4',handmade_profile:'human-stroke-v2',stroke_width_range:[4,9],colors:['#2F3C44','#435064','#FFFDF9','#F6F0E6']};
const svg='<svg xmlns="http://www.w3.org/2000/svg"><metadata>style=zodiac-paper-doodle-meme-v4;handmade=human-stroke-v2</metadata><path d="M0 0L10 10" stroke="#435064" stroke-width="8"/></svg>';
function fixture(){
 return {
  intent:{scene_plan:{scenes:[{id:'S01',purpose:'Introduce remembered detail',beats:['B1']}],single_scene_rationale:'One focused beat',continuous_visual_logic:'Single setup beat'},scenes:[{id:'S01',director_beats:[{beat_id:'B1',voice_anchor:'Một câu.',semantic_purpose:'setup',supported_motion_or_state:'state_swap'}],entities:[],events:[{id:'E1',motion:{preset:'state_swap',duration_frames:12}}]}],scene_plan:{scenes:[{id:'S01',purpose:'Setup the behavior',beats:['B1']}],single_scene_rationale:'Single-scene fixture isolates the progressive preflight contract.'},assets:{A:{category:'scene_accent',path:'assets/a.svg',lineage:{mode:'authored_derivative'}}}},
  production:{assets:{A:{category:'environment',path:'assets/a.svg'}},scenes:[{id:'S01',voice:'Một câu.',entities:[],events:[{id:'E1',motion:{preset:'state_swap',duration_frames:12}}]}]}
 };
}
test('progressive preflight passes a valid authored fixture',async()=>{
 const f=fixture();const r=await validateProgressivePreflight({...f,motionRegistry:registry,designToken:token,readAsset:async()=>svg});
 assert.equal(r.status,'PASS');
});
test('progressive preflight blocks incomplete director beat before native compile',async()=>{
 const f=fixture();delete f.intent.scenes[0].director_beats[0].voice_anchor;
 const r=await validateProgressivePreflight({...f,motionRegistry:registry,designToken:token,readAsset:async()=>svg});
 assert.ok(r.issues.some(x=>x.code==='DIRECTOR_BEAT_INCOMPLETE'));
});
test('progressive preflight blocks registry duration mismatch',async()=>{
 const f=fixture();f.production.scenes[0].events[0].motion.duration_frames=10;
 const r=await validateProgressivePreflight({...f,motionRegistry:registry,designToken:token,readAsset:async()=>svg});
 assert.ok(r.issues.some(x=>x.code==='MOTION_DURATION_MISMATCH'));
});
test('progressive preflight blocks authored SVG metadata stroke and palette defects',async()=>{
 const f=fixture();const bad='<svg><path stroke="#50585C" stroke-width="12"/></svg>';
 const r=await validateProgressivePreflight({...f,motionRegistry:registry,designToken:token,readAsset:async()=>bad});
 assert.ok(r.issues.some(x=>x.code==='AUTHORED_SVG_STYLE_METADATA'));
 assert.ok(r.issues.some(x=>x.code==='AUTHORED_SVG_STROKE_WIDTH'));
 assert.ok(r.issues.some(x=>x.code==='AUTHORED_SVG_PALETTE'));
});

test('progressive preflight blocks incomplete multi-scene Scene Plan before native compile',async()=>{
 const f=fixture();
 f.intent.scenes.push({id:'S02',director_beats:[{beat_id:'B2',voice_anchor:'Câu hai.',semantic_purpose:'reframe',supported_motion_or_state:'hold'}],entities:[],events:[]});
 f.intent.scene_plan={scenes:[{id:'S01',purpose:'Introduce behavior',beats:['B1']},{id:'S02',purpose:'Reframe behavior',beats:[]}]};
 f.production.scenes.push({id:'S02',voice:'Câu hai.',entities:[],events:[]});
 const r=await validateProgressivePreflight({...f,motionRegistry:registry,designToken:token,readAsset:async()=>svg});
 assert.ok(r.issues.some(x=>x.code==='SCENE_BEATS_MISSING'&&x.scene_id==='S02'));
 assert.ok(r.issues.some(x=>x.code==='SCENE_TRANSITION_MISSING'&&x.scene_id==='S02'));
});
