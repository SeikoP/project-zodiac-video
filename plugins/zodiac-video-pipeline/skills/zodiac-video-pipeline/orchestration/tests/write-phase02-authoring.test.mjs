import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {assessAuthoringPayload,writePhase02Authoring} from '../../features/visual-composition/write-phase02-authoring.mjs';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import path from 'node:path';
const narration='Cung Bảo Bình nghĩ khác.\nRồi cân nhắc một hướng khác.\n';
const hash=createHash('sha256').update(narration).digest('hex');
const state={phases:{'01-content':{status:'PASS'}},review_receipts:[{phase_id:'01-content',status:'APPROVED',proof:{kind:'user_message',ref:'message-10'}}]};
const payload=()=>({format:'zodiac-phase02-authored-handoff@1',plugin_version:'2.4.28',approved_narration_sha256:hash,production:{version:'2.0',video:{width:1080,height:1920,fps:30},assets:{a:{path:'assets/actor.svg',category:'character'}},scenes:[{id:'s01',voice:'Cung Bảo Bình nghĩ khác.',entities:[{id:'hero',initial_state:'idle',states:{idle:{asset:'a'}}}],events:[{id:'e01',target:'hero',state_before:'idle',state_after:'idle',trigger:{type:'voice_anchor',text:'nghĩ khác'}}]},{id:'s02',voice:'Rồi cân nhắc một hướng khác.',entities:[{id:'hero',initial_state:'idle',states:{idle:{asset:'a'}}}],events:[]}]},asset_plan:{semantic_asset_fit:{format:'zodiac-semantic-asset-plan@1',decisions:[]}},visual_grammar_plan:{format:'zodiac-visual-grammar-plan@1',scenes:[{scene_id:'s01',frame_id:'f',mechanic_id:'m'},{scene_id:'s02',frame_id:'f',mechanic_id:'m'}]},character_assembly_plan:{format:'zodiac-character-assembly-plan@2',characters:[{entity_id:'hero',design_intent:{role:'lead'}}]}});
test('approved narration plus substantive plans can enter strict preflight',()=>{const r=assessAuthoringPayload(payload(),{narration,pluginVersion:'2.4.28',state});assert.equal(r.status,'AUTHORING_PAYLOAD_VALID');assert.equal(r.not_compiled,true)});
test('changed voice fails approved narration lock',()=>{const p=payload();p.production.scenes[1].voice='Other text';assert.ok(assessAuthoringPayload(p,{narration,pluginVersion:'2.4.28',state}).issues.some(x=>x.code==='SCENE_VOICE_DOES_NOT_MATCH_APPROVED_NARRATION'))});
test('missing actual content approval blocks',()=>{const s={...state,review_receipts:[]};assert.ok(assessAuthoringPayload(payload(),{narration,pluginVersion:'2.4.28',state:s}).issues.some(x=>x.code==='CONTENT_APPROVAL_MISSING'))});
test('empty agent-authored plans are rejected',()=>{const p=payload();p.asset_plan={};p.character_assembly_plan={};assert.equal(assessAuthoringPayload(p,{narration,pluginVersion:'2.4.28',state}).status,'BLOCKED')});
test('stale narration hash fails closed',()=>{const p=payload();p.approved_narration_sha256='deadbeef';assert.ok(assessAuthoringPayload(p,{narration,pluginVersion:'2.4.28',state}).issues.some(x=>x.code==='APPROVED_NARRATION_CHANGED'))});

test('missing canvas geometry and broken voice anchors are rejected',()=>{const p=payload();delete p.production.video;p.production.scenes[0].events[0].trigger.text='bad phrase';const codes=assessAuthoringPayload(p,{narration,pluginVersion:'2.4.28',state}).issues.map(x=>x.code);assert.ok(codes.includes('PRODUCTION_VIDEO_CONTRACT_MISSING'));assert.ok(codes.includes('VOICE_ANCHOR_NOT_IN_SCENE'))});

test('nonempty placeholder plans must not count as executable authoring',()=>{const p=payload();p.visual_grammar_plan={version:'1'};p.asset_plan={version:'1'};const codes=assessAuthoringPayload(p,{narration,pluginVersion:'2.4.28',state}).issues.map(x=>x.code);assert.ok(codes.includes('VISUAL_GRAMMAR_PLAN_INCOMPLETE'));assert.ok(codes.includes('SEMANTIC_ASSET_PLAN_INCOMPLETE'))});

async function revisionWorkspace(){
 const root=await mkdtemp(path.join(tmpdir(),'z-author-revise-'));await mkdir(path.join(root,'.authoring'));
 const plugin=JSON.parse(await readFile(new URL('../../../../plugin.json',import.meta.url),'utf8'));
 const s={...structuredClone(state),run_mode:'continuity',current_phase:'02-visual-production'};
 s.phases['02-visual-production']={status:'READY',current_step:'visual_compile',steps:{visual_compile:{status:'READY'}}};
 await writeFile(path.join(root,'.authoring/pipeline-state.json'),JSON.stringify(s));await writeFile(path.join(root,'narration.txt'),narration);
 const p=payload();p.plugin_version=plugin.version;const payloadPath=path.join(root,'input.json');await writeFile(payloadPath,JSON.stringify(p));
 await writePhase02Authoring({workspace:root,payloadPath});return {root,p,payloadPath,s};
}

test('explicit revision updates projections only after reopening the owning visual step',async()=>{
 const {root,p,payloadPath,s}=await revisionWorkspace();
 try{p.production.scenes[0].semantic_goal='Thay đổi bố cục';await writeFile(payloadPath,JSON.stringify(p));
  await assert.rejects(()=>writePhase02Authoring({workspace:root,payloadPath}),/AUTHORING_REVISION_REQUIRED/);
  assert.equal(JSON.parse(await readFile(path.join(root,'production.json'),'utf8')).scenes[0].semantic_goal,undefined);
  const r=await writePhase02Authoring({workspace:root,payloadPath,revise:true});assert.equal(r.status,'AUTHORING_WRITTEN_NOT_COMPILED');
  assert.equal(JSON.parse(await readFile(path.join(root,'production.json'),'utf8')).scenes[0].semantic_goal,p.production.scenes[0].semantic_goal);
  s.phases['02-visual-production'].status='IN_REVIEW';await writeFile(path.join(root,'.authoring/pipeline-state.json'),JSON.stringify(s));
  await assert.rejects(()=>writePhase02Authoring({workspace:root,payloadPath,revise:true}),/AUTHORING_REOPEN_REQUIRED/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('revision refuses drift in approved content and preserves existing projections',async()=>{
 const {root,p,payloadPath,s}=await revisionWorkspace();
 try{const original=await readFile(path.join(root,'production.json'),'utf8');s.review_receipts[0].source_hashes={narration:'0'.repeat(64)};await writeFile(path.join(root,'.authoring/pipeline-state.json'),JSON.stringify(s));p.production.scenes[0].semantic_goal='new';await writeFile(payloadPath,JSON.stringify(p));await assert.rejects(()=>writePhase02Authoring({workspace:root,payloadPath,revise:true}),/CONTENT_APPROVAL_SOURCE_DRIFT/);assert.equal(await readFile(path.join(root,'production.json'),'utf8'),original);}finally{await rm(root,{recursive:true,force:true});}
});

test('canonical Visual Intent revision restores every prior projection if cache update fails',async()=>{
 const {root,payloadPath}=await revisionWorkspace();
 try{
  const {cacheRoot}=await import('../../core/cache/incremental-cache.mjs');
  const token={id:'zodiac-paper-doodle-meme-v4',version:'4.0',hard_style_lock:true,handmade_profile:'human-stroke-v2'};
  await writeFile(path.join(root,'design.md'),'<!-- STYLE_TOKEN_BEGIN -->\n```json\n'+JSON.stringify(token)+'\n```\n<!-- STYLE_TOKEN_END -->');
  const input={format:'zodiac-visual-intent@1',narration_sha256:hash,assets:{a:{path:'assets/cup.svg'}},video:{width:1080,height:1920,fps:30},cast:[],frames:[],taxonomy_version:'narrative_visual@1',narrative_visual_decision:{mode:'omitted',reason:'Phase 1 selected no Narrative Visual.'},scenes:[{id:'s01',narration_range:[0,Buffer.byteLength(narration)],semantic_goal:'A greeting',grammar:{frame_id:'prop-focus',mechanic_id:'reveal',bindings:{focus_prop:'cup'}},entities:[{id:'cup',kind:'object',initial_state:'on',states:{on:{asset:'a'}}}],semantic_asset_decisions:[{entity_id:'cup',reason:'Physical cup'}],events:[]}]};
  await writeFile(payloadPath,JSON.stringify(input));
  await writePhase02Authoring({workspace:root,payloadPath,revise:true});
  const {projectionPaths}=await import('../../features/visual-composition/compile-visual-intent.mjs');
  const paths=[...Object.values(projectionPaths),'.authoring/visual-intent.json','.authoring/visual-intent-projection-receipt.json'];
  const originals=await Promise.all(paths.map(p=>readFile(path.join(root,p))));
  await writeFile(path.join(cacheRoot(root),'phase02-semantic-graph.json'),'invalid-json');
  input.scenes[0].semantic_goal='Changed meaning';await writeFile(payloadPath,JSON.stringify(input));
  await assert.rejects(()=>writePhase02Authoring({workspace:root,payloadPath,revise:true}),SyntaxError);
  for(let i=0;i<paths.length;i++)assert.deepEqual(await readFile(path.join(root,paths[i])),originals[i],paths[i]);
 }finally{await rm(root,{recursive:true,force:true});}
});
