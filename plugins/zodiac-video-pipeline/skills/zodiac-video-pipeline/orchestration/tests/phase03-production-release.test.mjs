import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,access} from 'node:fs/promises';
import os from 'node:os'; import path from 'node:path';
import {buildReviewLock,assertReviewLock,assertProductionSemantics,assertBrandIntent} from '../phase03-production-release.mjs';

const sha=(await import('node:crypto')).createHash;
const hash=value=>sha('sha256').update(value).digest('hex');
const pkg=()=>({format:'zodiac-authoring-ir@1',assets:{E:{category:'effect',path:'assets/effects/flash.svg'},C:{category:'character',path:'assets/characters/hero.svg'}},scenes:[{id:'S01',voice:'Đừng giả vờ nữa.',entities:[{id:'hero',initial_state:'on',states:{on:{asset:'C',visible:true,transform:{x:100,y:200,width:340,height:450}}}},{id:'fx',initial_state:'off',states:{off:{asset:'E',visible:false},on:{asset:'E',visible:true,transform:{x:250,y:330,width:210,height:180}}}}],events:[{id:'e1',target:'fx',trigger:{type:'voice_anchor',text:'giả vờ'},desired_motion:'pop-in',state_before:'off',state_after:'on'},{id:'e2',target:'fx',trigger:{type:'voice_anchor',text:'nữa'},desired_motion:'fade-out',state_before:'on',state_after:'off'}],spatial_bindings:[{entity:'fx',anchor:'hero',relation:'emitted_by',max_distance_px:350}],caption_segments:[{text:'Đừng giả vờ nữa.'}]}]});
const token={brand_overlay:{enabled:true,text:'✦ bungmoto',font_family:'Patrick Hand'},caption_emphasis:{font_family:'Patrick Hand'}};

test('release gate rejects effect without spatial anchor',()=>{const ir=pkg();ir.scenes[0].spatial_bindings=[];assert.throws(()=>assertProductionSemantics(ir),/SPATIAL_BINDING_REQUIRED/)});
test('release gate rejects effect without release transition',()=>{const ir=pkg();ir.scenes[0].events.pop();assert.throws(()=>assertProductionSemantics(ir),/EFFECT_RELEASE_REQUIRED/)});
test('release gate rejects non-channel brand and font fallback',()=>{assert.throws(()=>assertBrandIntent({brand_overlay:{enabled:false},caption_emphasis:{font_family:'Arial'}}),/BRAND_INTENT/);assert.doesNotThrow(()=>assertBrandIntent(token));});
test('source approval lock rejects post-review asset change and missing phase approval',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'zodiac-release-lock-'));
 try{await mkdir(path.join(dir,'assets'),{recursive:true});await writeFile(path.join(dir,'production.json'),'{}');await writeFile(path.join(dir,'design.md'),'token');await writeFile(path.join(dir,'narration.txt'),'approved');await writeFile(path.join(dir,'assets/a.svg'),'<svg/>');
 const approvals=[{phase_id:'01-content',status:'APPROVED',proof:{kind:'user_message',ref:'user-message:1'}},{phase_id:'02-visual-production',status:'APPROVED',proof:{kind:'user_message',ref:'user-message:2'}}];
 const lock=await buildReviewLock(dir,{review_receipts:approvals});assert.equal(lock.format,'zodiac-phase02-review-lock@1');await assertReviewLock(dir,lock);
 await writeFile(path.join(dir,'assets/a.svg'),'<svg><!-- changed --></svg>');await assert.rejects(()=>assertReviewLock(dir,lock),/REVIEW_SOURCE_CHANGED/);
 await writeFile(path.join(dir,'assets/a.svg'),'<svg/>');await mkdir(path.join(dir,'publish'));await writeFile(path.join(dir,'publish/publish.json'),'{}');await assert.rejects(()=>assertReviewLock(dir,lock),/REVIEW_SOURCE_CHANGED/);
 await assert.rejects(()=>buildReviewLock(dir,{review_receipts:approvals.slice(0,1)}),/PHASE_APPROVAL_MISSING/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('export rejects missing approved visual evidence before ZIP creation',async()=>{
 const {exportZodiacJobV2}=await import('../export-zodiac-job-v2.mjs');
 const out=path.join(os.tmpdir(),'must-not-create-phase03-'+Date.now()+'.zip');
 await assert.rejects(()=>exportZodiacJobV2('/nonexistent/package',out),/APPROVAL_EVIDENCE_REQUIRED/);
 await assert.rejects(()=>access(out));
});

test('production model narrative source checksum uses raw approved bytes',async()=>{
 const tmp=await mkdtemp(path.join(os.tmpdir(),'prod-model-'));
 try{await writeFile(path.join(tmp,'production.ir.json'),JSON.stringify({format:'zodiac-authoring-ir@1',fps:24,video:{width:1080,height:1920},assets:{},scenes:[{id:'S01',voice:'Này!',entities:[],events:[]}]}));await writeFile(path.join(tmp,'narration.txt'),'Này!');await writeFile(path.join(tmp,'design-token.json'),'{}');await mkdir(path.join(tmp,'publish'));await writeFile(path.join(tmp,'publish/publish.json'),'{}');
 const {migrateLegacyJob5}=await import('../migrate-production-model.mjs');const model=migrateLegacyJob5(tmp);
 assert.equal(model.source.narration_sha256,hash('Này!'));
 }finally{await rm(tmp,{recursive:true,force:true});}
});

test('Job@5 compiler pins channel voice/brand visual intent without weakening narrator scripts',async()=>{
 const {compileJobV5}=await import('../compile-job-v5.mjs');
 const schema=JSON.parse(await readFile(new URL('../../references/contracts/authoring-ir-v1.schema.json',import.meta.url),'utf8'));
 const style={id:'zodiac-paper-doodle-meme-v4',version:'4.0',style_family:'paper-doodle-chibi-meme',handmade_profile:'human-stroke-v2'};
 const mark=`<!-- STYLE_TOKEN_BEGIN -->\n\`\`\`json\n${JSON.stringify(style)}\n\`\`\`\n<!-- STYLE_TOKEN_END -->`;
 const source={version:'2.0',video:{width:1080,height:1920,fps:24},assets:{},scenes:[{id:'S01',voice:'Này, nhìn cho rõ!',entities:[],events:[]}]};
 const {designToken}=compileJobV5(source,mark,{sign:'Bọ Cạp',concept:'Gắt',contractSchema:schema});
 assertBrandIntent(designToken);
});

test('phase03 source-to-IR parity rejects edited character transforms after visual approval',async()=>{
 const {assertAuthoringProjection}=await import('../phase03-production-release.mjs');
 const s={version:'2.0',video:{width:1080,height:1920,fps:24},assets:{C:{path:'assets/characters/main.svg',category:'character'}},scenes:[{id:'S01',voice:'Bọ Cạp nhìn kỹ.',entities:[{id:'actor',initial_state:'idle',states:{idle:{asset:'C',visible:true,transform:{x:210,y:200,width:500,height:600}}}}],events:[]}]};
 const ir={format:'zodiac-authoring-ir@1',fps:24,video:{width:1080,height:1920},assets:s.assets,scenes:[{id:'S01',voice:s.scenes[0].voice,entities:s.scenes[0].entities,events:[]}]};
 assert.doesNotThrow(()=>assertAuthoringProjection(s,ir));
 ir.scenes[0].entities=structuredClone(ir.scenes[0].entities);
 ir.scenes[0].entities[0].states.idle.transform.x=760;
 assert.throws(()=>assertAuthoringProjection(s,ir),/APPROVED_AUTHORING_DRIFT/);
});

test('production release requires usable cover and publish text before export',async()=>{
 const {assertPublishIntent}=await import('../phase03-production-release.mjs');
 const ir=pkg();
 assert.throws(()=>assertPublishIntent({format:'zodiac-publish@1',caption:'Bọ Cạp',hashtags:['#bocap']},'',ir),/PUBLISH_INTENT_INVALID/);
});

test('reviewed action voice anchors and scheduling cannot change after Visual Review',async()=>{
 const {assertAuthoringProjection}=await import('../phase03-production-release.mjs');
 const source={assets:{C:{category:'character',path:'assets/characters/hero.svg'}},scenes:[{id:'S01',voice:'Bọ Cạp bảo không sao.',entities:[{id:'actor',initial_state:'idle',states:{idle:{asset:'C'}}}],events:[{id:'E01',target:'actor',action:'respond',state_before:'idle',state_after:'idle',motion:{preset:'hold',duration_frames:8},trigger:{type:'voice_anchor',text:'không sao'},scheduling:{max_drift_frames:0,merge_policy:'never'}}]}]};
 const ir={assets:structuredClone(source.assets),scenes:[{id:'S01',voice:source.scenes[0].voice,entities:structuredClone(source.scenes[0].entities),events:[{id:'E01',target:'actor',intent:'respond',state_before:'idle',state_after:'idle',desired_motion:'hold',trigger:{type:'voice_anchor',text:'không sao'},scheduling:{max_drift_frames:0,merge_policy:'never'}}]}]};
 assert.doesNotThrow(()=>assertAuthoringProjection(source,ir));
 ir.scenes[0].events[0].trigger.text='Bọ Cạp';
 assert.throws(()=>assertAuthoringProjection(source,ir),/APPROVED_AUTHORING_DRIFT/);
 ir.scenes[0].events[0].trigger.text='không sao';ir.scenes[0].events[0].scheduling.max_drift_frames=90;
 assert.throws(()=>assertAuthoringProjection(source,ir),/APPROVED_AUTHORING_DRIFT/);
});
test('publish intent cannot be changed in staging after reviewed source',async()=>{
 const {assertPublishProjection}=await import('../phase03-production-release.mjs');
 const original={version:'1.5',source:{narration:'narration.txt',production:'production.json'},caption:'Một câu gắt',cover:{hook:'Bọ Cạp nói sao?',visuals:[]}};
 const compiled={...structuredClone(original),format:'zodiac-publish@1',source:{narration:'narration.txt',production:'production.ir.json'}};
 assert.doesNotThrow(()=>assertPublishProjection(original,compiled));
 compiled.cover.hook='Hook khác';
 assert.throws(()=>assertPublishProjection(original,compiled),/APPROVED_PUBLISH_DRIFT/);
});

test('Phase03 semantic gate rejects endpoints that do not chain from initial state',()=>{
 const ir=pkg();ir.scenes[0].entities[1].initial_state='on';
 assert.throws(()=>assertProductionSemantics(ir),/EVENT_STATE_CHAIN_INVALID/);
});

// Bọ Cạp S07 regression: near is symmetric. A hero-near-door binding already
// establishes contact for the evented door; no additional reciprocal edge
// or approved source mutation is needed. Directed relationships stay directed.
test('release accepts reverse near contact for an evented prop without editing approved production',()=>{
 const ir=pkg();
 ir.assets.D={category:'prop',path:'assets/props/door.svg'};
 ir.scenes[0].entities.push({id:'door',initial_state:'closed',states:{closed:{asset:'D'},open:{asset:'D'}}});
 ir.scenes[0].events.push({id:'door_open',target:'door',state_before:'closed',state_after:'open',desired_motion:'state_swap',trigger:{type:'voice_anchor',text:'giả vờ'}});
 ir.scenes[0].spatial_bindings.push({entity:'hero',anchor:'door',relation:'near',max_distance_px:950});
 assert.doesNotThrow(()=>assertProductionSemantics(ir));
});
test('release rejects reversed directed contact for props',()=>{
 const ir=pkg();
 ir.assets.D={category:'prop',path:'assets/props/door.svg'};
 ir.scenes[0].entities.push({id:'door',initial_state:'closed',states:{closed:{asset:'D'},open:{asset:'D'}}});
 ir.scenes[0].events.push({id:'door_open',target:'door',state_before:'closed',state_after:'open',desired_motion:'state_swap',trigger:{type:'voice_anchor',text:'giả vờ'}});
 ir.scenes[0].spatial_bindings.push({entity:'hero',anchor:'door',relation:'held_by',max_distance_px:950});
 assert.throws(()=>assertProductionSemantics(ir),/SPATIAL_BINDING_REQUIRED/);
});

test('Phase03 rejects noncontact state slide and accepts authored S05 friend retreat',()=>{
 const ir=pkg(),s=ir.scenes[0];
 s.assets=undefined;
 ir.assets.W={category:'character',path:'assets/characters/friend-wait.svg'};
 ir.assets.R={category:'character',path:'assets/characters/friend-withdraw.svg'};
 s.entities.push({id:'friend',initial_state:'wait',states:{wait:{asset:'W',visible:true,transform:{x:625,y:500,width:300,height:420}},withdraw:{asset:'R',visible:true,transform:{x:775,y:500,width:300,height:420}}}});
 s.events.push({id:'S05_friend_leaves',target:'friend',state_before:'wait',state_after:'withdraw',desired_motion:'slide'});
 assert.throws(()=>assertProductionSemantics(ir),/SLIDE_MOTION_QA.*SLIDE_CONTACT_BINDING_REQUIRED/);
 s.spatial_bindings.push({entity:'friend',anchor:'hero',relation:'near',max_distance_px:850});
 assert.doesNotThrow(()=>assertProductionSemantics(ir));
});
