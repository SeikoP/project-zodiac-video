import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {compileJobV5,compileWorkspace,captionSegmentsForScene} from '../compile-job-v5.mjs';
import {validateHandoffV2} from '../validate-handoff-workspace-v2.mjs';
import {validateJob5Workspace} from '../validate-job5-import-gate.mjs';
import {design} from './handoff-fixture.mjs';

const char=(id,asset)=>({id,initial_state:'neutral',states:{neutral:{asset,visible:true},point:{asset,visible:true}}});
const source=()=>({version:'2.0',video:{width:1080,height:1920,fps:30},assets:{
 HERO:{path:'assets/hero.svg',category:'character',style_id:'zodiac-paper-doodle-meme-v4'},
 MAP:{path:'assets/map.svg',category:'prop',style_id:'zodiac-paper-doodle-meme-v4'},
 CLASS:{path:'assets/class.svg',category:'environment',style_id:'zodiac-paper-doodle-meme-v4'}
},scenes:[
 {id:'S01',voice:'Nhân Mã chỉ vào tấm bản đồ. Ai cũng thấy chấm nhỏ ấy thật kỳ lạ.',duration_hint_frames:300,
  entities:[char('hero','HERO'),{id:'paper_map',initial_state:'unmarked',states:{unmarked:{asset:'MAP',visible:true,transform:{x:610,y:690,width:260,height:240}},marked:{asset:'MAP',visible:true,transform:{x:610,y:690,width:260,height:240}}}},{id:'env__window',initial_state:'visible',states:{visible:{asset:'CLASS'}}}],
  render_density_budget:{max_characters:1,max_prominent_props:1,max_prominent_effects:0},
  events:[{id:'E01',target:'paper_map',action:'mark',state_before:'unmarked',state_after:'marked',trigger:{type:'scene_start'},motion:{preset:'state_swap',duration_frames:12}}]},
 {id:'S02',voice:'Nhân Mã chỉ tay. Rồi cả lớp chăm chú nhìn theo.',duration_hint_frames:150,
  entities:[char('hero','HERO'),{id:'env__window',initial_state:'visible',states:{visible:{asset:'CLASS'}}}],
  render_density_budget:{max_characters:1,max_prominent_props:0,max_prominent_effects:0},
  events:[{id:'E02',target:'hero',action:'point',state_before:'neutral',state_after:'point',trigger:{type:'voice_anchor',text:'Nhân Mã chỉ tay.'},motion:{preset:'state_swap',duration_frames:12}}]}
]});
const schema=JSON.parse(await readFile(new URL('../../references/contracts/authoring-ir-v1.schema.json',import.meta.url)));
const voice=s=>s.scenes.map(x=>x.voice).join('\n\n')+'\n';
async function fixture(){const d=await mkdtemp(path.join(os.tmpdir(),'zodiac-phase03-boundary-'));
 const s=source();await mkdir(path.join(d,'assets'));await mkdir(path.join(d,'publish'));
 await writeFile(path.join(d,'production.json'),JSON.stringify(s));await writeFile(path.join(d,'design.md'),design);
 await writeFile(path.join(d,'narration.txt'),voice(s));
 for(const k of ['hero','map','class'])await writeFile(path.join(d,'assets',k+'.svg'),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>');
 await writeFile(path.join(d,'publish/publish.json'),JSON.stringify({version:'1.5',platform:'tiktok',source:{narration:'narration.txt',production:'production.json'},caption:'Nhân Mã chỉ vào tấm bản đồ.'}));
 await writeFile(path.join(d,'publish/publish-copy.txt'),'COVER IDENTITY: NHÂN MÃ\nHOOK: Bản đồ\nTIKTOK CAPTION: Bản đồ.\nHASHTAGS: #nhanma\n');return d;}

test('Phase02 30fps becomes Job@5 24fps with explicit duration scaling, not identity changes',()=>{
 const s=source(),r=compileJobV5(s,design,{sign:'Nhân Mã',concept:'Chấm nhỏ',contractSchema:schema});
 assert.equal(r.ir.fps,24);assert.equal(r.ir.scenes[0].duration_hint_frames,240);
 assert.equal(r.designToken.motion_defaults.state_swap.duration_frames,10);
 assert.equal(r.ir.scenes[0].entities[1].id,'paper_map');assert.equal(r.ir.scenes[0].events[0].target,'paper_map');
 assert.equal(r.ir.scenes[0].voice,s.scenes[0].voice);
});
test('caption segmentation splits Vietnamese on real whitespace, rather than one caption per long scene',()=>{
 const s='Nhân Mã chỉ vào tấm bản đồ. Ai cũng thấy chấm nhỏ ấy thật kỳ lạ. Một nơi chưa đến luôn đáng tò mò.';
 const captions=captionSegmentsForScene(s);assert.ok(captions.length>=2);
 assert.equal(captions.map(x=>x.text).join(' '),s);
 assert.ok(captions.every(x=>x.text.length<100));
});
test('exact approved narration preserved across two-scene blank-line boundary; categorized prop is not a character',async()=>{
 const d=await fixture();try{
  const before=await readFile(path.join(d,'narration.txt'));
  await compileWorkspace(d,{sign:'Nhân Mã',concept:'Chấm nhỏ',prune:true});
  const ir=JSON.parse(await readFile(path.join(d,'production.ir.json')));
  assert.equal(ir.scenes.map(s=>s.voice).join('\n'),before.toString().trimEnd());
  assert.deepEqual(await readFile(path.join(d,'narration.txt')),before);
  await validateHandoffV2(d);
  const gate=await validateJob5Workspace(d);assert.equal(gate.status,'PASS');
 }finally{await rm(d,{recursive:true,force:true});}
});
test('compiler rejects narration lexical drift rather than repairing the approved words',async()=>{
 const d=await fixture();try{await writeFile(path.join(d,'narration.txt'),'Không phải lời kể đã duyệt.\n');await assert.rejects(()=>compileWorkspace(d,{sign:'Nhân Mã',concept:'Chấm nhỏ',prune:true}),/approved narration differs/);}finally{await rm(d,{recursive:true,force:true});}
});
test('unsupported fps is rejected before producing runtime output',()=>{
 const s=source();s.video.fps=59;assert.throws(()=>compileJobV5(s,design,{sign:'Nhân Mã',concept:'Chấm nhỏ',contractSchema:schema}),/supported 24 or 30fps/);
});
