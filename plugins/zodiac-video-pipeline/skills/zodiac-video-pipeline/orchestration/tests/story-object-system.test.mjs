import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,rm,writeFile,readFile} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {validateStoryObjectPlan,validateStoryObjectWorkspace} from '../validate-story-object.mjs';

const narration='Cái cân đứng im.\nCái cân nghiêng sang bên kia.\nCái cân cuối cùng quay về chính mình.';
const checksum=x=>createHash('sha256').update(x).digest('hex');
const ASSET={category:'prop',style_id:'zodiac-paper-doodle-meme-v4',path:'assets/props/balance.svg'};
const FX={category:'effect',style_id:'zodiac-paper-doodle-meme-v4',path:'assets/effects/reaction.svg'};
const makeScene=(id,voice,step,from,to)=>({id,voice,entities:[
 {id:'balance',kind:'object',initial_state:'idle',states:{idle:{asset:'BALANCE',visible:true,transform:{x:150,y:220,width:580,height:440,rotation:0}},left:{asset:'BALANCE',visible:true,transform:{x:150,y:220,width:580,height:440,rotation:-11}},right:{asset:'BALANCE',visible:true,transform:{x:150,y:220,width:580,height:440,rotation:12}}}},
 {id:'accent',kind:'effect',initial_state:'off',states:{off:{asset:'FX',visible:false},on:{asset:'FX',visible:true}}}
],events:[
 {id:`${id}_object`,target:'balance',action:step,state_before:from,state_after:to,trigger:{type:'voice_anchor',text:voice.split(' ').slice(0,2).join(' ')},motion:{preset:'state_swap',duration_frames:12}},
 {id:`${id}_fx_on`,target:'accent',action:'enter',state_before:'off',state_after:'on',trigger:{type:'voice_anchor',text:voice.split(' ').slice(0,2).join(' ')},motion:{preset:'pop-in',duration_frames:8}},
 {id:`${id}_fx_off`,target:'accent',action:'release',state_before:'on',state_after:'off',trigger:{type:'voice_anchor',text:voice.split(' ').slice(-2).join(' ')},motion:{preset:'fade-out',duration_frames:8}}
 ],spatial_bindings:[{entity:'accent',anchor:'balance',relation:'emitted_by',max_distance_px:400}]});
const production=()=>({version:'2.0',visual_system:{style_token:{id:'zodiac-paper-doodle-meme-v4'}},assets:{BALANCE:structuredClone(ASSET),FX:structuredClone(FX)},scenes:[
 makeScene('S01','Cái cân đứng im.','compare','idle','left'),makeScene('S02','Cái cân nghiêng sang bên kia.','pressure','left','right'),makeScene('S03','Cái cân cuối cùng quay về chính mình.','callback','right','idle')
]});
const plan=()=>({format:'zodiac-story-object-plan@1',style_token:'zodiac-paper-doodle-meme-v4',narration_sha256:checksum(narration),central_metaphor:{id:'balance',meaning:'cân nhắc nhiều hướng',payoff_transformation:'quay cán cân về bản thân'},beats:[
 {beat_id:'B01',scene_id:'S01',role:'setup',voice_anchor:'Cái cân đứng im',object_entity:'balance',object_event_ids:['S01_object'],effect:{entity_id:'accent',event_ids:['S01_fx_on','S01_fx_off'],semantic_role:'compare',tier:1},visual_change:'cán cân đổi từ giữa sang trái',narrative_meaning:'mở ra hai hướng nhìn'},
 {beat_id:'B02',scene_id:'S02',role:'friction',voice_anchor:'Cái cân nghiêng sang bên kia',object_entity:'balance',object_event_ids:['S02_object'],effect:{entity_id:'accent',event_ids:['S02_fx_on','S02_fx_off'],semantic_role:'pressure',tier:2},visual_change:'cán cân nghiêng rõ sang phải',narrative_meaning:'nhiều hướng bắt đầu mâu thuẫn'},
 {beat_id:'B03',scene_id:'S03',role:'payoff',voice_anchor:'Cái cân cuối cùng quay về',object_entity:'balance',object_event_ids:['S03_object'],effect:{entity_id:'accent',event_ids:['S03_fx_on','S03_fx_off'],semantic_role:'callback',tier:3},visual_change:'cán cân quay vào người nói',narrative_meaning:'đòn kết lật cách nhìn ban đầu'}
 ],payoff_beat_id:'B03'});
const fail=(p,source=production(),voice=narration)=>validateStoryObjectPlan(p,source,voice).issues.map(x=>x.code);
test('story object validates meaningful setup → friction → payoff on real V4 props and events',()=>{
 const r=validateStoryObjectPlan(plan(),production(),narration);assert.equal(r.status,'PASS',JSON.stringify(r.issues));assert.equal(r.beats,3);
});
test('reject wrong narration hash, missing voice quote and foreign token',()=>{
 for(const [mutate,expected] of [[x=>x.narration_sha256='0'.repeat(64),'NARRATION_HASH_MISMATCH'],[x=>x.beats[0].voice_anchor='không có','VOICE_ANCHOR_MISSING'],[x=>x.style_token='legacy-v3','STYLE_TOKEN_MISMATCH']]){
  const p=plan();mutate(p);assert.ok(fail(p).includes(expected),JSON.stringify(fail(p)));
 }
});
test('reject missing object and fake event or static no-op as storytelling',()=>{
 const bad=plan();bad.beats[0].object_entity='missing';assert.ok(fail(bad).includes('OBJECT_ENTITY_INVALID'));
 const bad2=plan();bad2.beats[1].object_event_ids=['ghost'];assert.ok(fail(bad2).includes('OBJECT_EVENT_MISSING'));
 const source=production();source.scenes[1].events[0].state_after='left';source.scenes[1].events[0].motion={preset:'hold',duration_frames:8};assert.ok(fail(plan(),source).includes('OBJECT_EVENT_DECORATIVE'));
});
test('reject missing actual payoff and tier regression',()=>{
 const p=plan();p.payoff_beat_id='B02';assert.ok(fail(p).includes('PAYOFF_CALLBACK_INVALID'));
 const p2=plan();p2.beats[2].effect.tier=1;assert.ok(fail(p2).includes('EFFECT_ESCALATION_INVALID'));
});
test('reject unlinked support effect, wrong native style and purely decorative event',()=>{
 const p=plan();p.beats[1].effect.event_ids=['S01_fx_on'];assert.ok(fail(p).includes('EFFECT_EVENT_MISSING'));
 const src=production();src.assets.FX.style_id='legacy-v3';assert.ok(fail(plan(),src).includes('ASSET_STYLE_TOKEN_MISMATCH'));
});
test('workspace must reject missing plan when story object is explicitly required',async()=>{
 const tmp=await mkdtemp(path.join(os.tmpdir(),'zodiac-object-'));
 try{
  await mkdir(path.join(tmp,'.authoring'));
  await writeFile(path.join(tmp,'production.json'),JSON.stringify(production()));
  await writeFile(path.join(tmp,'narration.txt'),narration);
  await writeFile(path.join(tmp,'.authoring/story-object-required.json'),JSON.stringify({required:true}));
  await assert.rejects(()=>validateStoryObjectWorkspace(tmp),/STORY_OBJECT_PLAN_MISSING/);
  await writeFile(path.join(tmp,'.authoring/story-object-plan.json'),JSON.stringify(plan()));
  const res=await validateStoryObjectWorkspace(tmp,{writeReceipt:true});assert.equal(res.status,'PASS');
  const receipt=JSON.parse(await readFile(path.join(tmp,'.authoring','story-object-qc.json')));
  assert.equal(receipt.status,'PASS');
  await writeFile(path.join(tmp,'narration.txt'),'changed');
  await assert.rejects(()=>validateStoryObjectWorkspace(tmp),/NARRATION_HASH_MISMATCH/);
 }finally{await rm(tmp,{recursive:true,force:true});}
});

test('Phase 03 lock fingerprints semantic object plan so post-review edits block release',async()=>{
 const {sourceReviewFingerprint}=await import('../phase03-production-release.mjs');
 const dir=await mkdtemp(path.join(os.tmpdir(),'zodiac-object-lock-'));
 try{
  await mkdir(path.join(dir,'.authoring'));await mkdir(path.join(dir,'assets'));
  for(const [p,data] of [['production.json','{}'],['design.md','d'],['narration.txt',narration]])await writeFile(path.join(dir,p),data);
  await writeFile(path.join(dir,'.authoring/story-object-plan.json'),JSON.stringify(plan()));
  const a=await sourceReviewFingerprint(dir);
  const changed=plan();changed.beats[0].visual_change='cán cân lên tiếng rất mạnh!';
  await writeFile(path.join(dir,'.authoring/story-object-plan.json'),JSON.stringify(changed));
  const b=await sourceReviewFingerprint(dir);
  assert.notEqual(a.sha256,b.sha256,'approved source must include story-object-plan bytes');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('production entrypoint blocks missing Phase02 evidence before story-object validation and ZIP',async()=>{
 const {runPhase03Production}=await import('../run-phase03-production.mjs');
 const dir=await mkdtemp(path.join(os.tmpdir(),'zodiac-object-phase03-'));
 try{
  await mkdir(path.join(dir,'.authoring'));
  await writeFile(path.join(dir,'.authoring/story-object-required.json'),'{"required":true}');
  await assert.rejects(()=>runPhase03Production({sourceRoot:dir,outputDir:path.join(dir,'out'),sign:'bocap',concept:'can-doi'}),/PHASE03_STATE_EVIDENCE_BLOCKED/);
  await assert.rejects(()=>readFile(path.join(dir,'out','zodiac-bocap-can-doi.zip')));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Director native review invokes story-object validator before preview generation when opted in',async()=>{
 const wrapper=await readFile(new URL('../run-director-v2-review.mjs',import.meta.url),'utf8');
 assert.match(wrapper,/validate-story-object\.mjs/);
 assert.match(wrapper,/findIndex\(x=>x\.id==='native_preview_build_v2'\)/);
 assert.match(wrapper,/stages\.splice\(before,0,\{id:'story_object_v1'/);
});

test('same SVG and transform in named states is NOT a visual action, even when event state ID changes',()=>{
 const source=production();source.scenes[1].entities[0].states.right=structuredClone(source.scenes[1].entities[0].states.left);
 assert.ok(fail(plan(),source).includes('OBJECT_EVENT_DECORATIVE'));
});
test('identical metaphor visual change repeated as a decorative claim blocks',()=>{
 const p=plan();p.beats[1].visual_change=p.beats[0].visual_change;
 assert.ok(fail(p).includes('STORY_VISUAL_REPETITION'));
});

test('new Phase-02 source template enables story-object mode for fresh content',async()=>{
 const template=JSON.parse(await readFile(new URL('../pipeline-state.template.json',import.meta.url),'utf8'));
 assert.equal(template.flags.story_object_required,true);
});
test('new fresh run blocks absent story object plan by release policy',async()=>{
 const tmp=await mkdtemp(path.join(os.tmpdir(),'zodiac-object-fresh-'));
 try{
  await mkdir(path.join(tmp,'.authoring'));
  await writeFile(path.join(tmp,'.authoring/pipeline-state.json'),JSON.stringify({plugin_version:'2.4.4',run_mode:'fresh',flags:{}}));
  await assert.rejects(()=>validateStoryObjectWorkspace(tmp),/STORY_OBJECT_PLAN_MISSING/);
 }finally{await rm(tmp,{recursive:true,force:true});}
});
test('payoff cannot quietly switch to a different central object',()=>{
 const source=production(),p=plan(),last=source.scenes[2];
 const alternate=structuredClone(last.entities[0]);alternate.id='other';last.entities.push(alternate);
 last.events[0].target='other';p.beats[2].object_entity='other';
 assert.ok(fail(p,source).includes('OBJECT_METAPHOR_IDENTITY_DRIFT'));
});
