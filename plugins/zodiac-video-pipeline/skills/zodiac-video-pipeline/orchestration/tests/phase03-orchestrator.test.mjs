import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,access} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {buildReviewLock} from '../phase03-production-release.mjs';
import {runPhase03Production} from '../run-phase03-production.mjs';

const design={id:'zodiac-paper-doodle-meme-v4',version:'4.0',style_family:'paper-doodle-chibi-meme',handmade_profile:'human-stroke-v2',caption_emphasis:{font_family:'Patrick Hand'}};
const style=`<!-- STYLE_TOKEN_BEGIN -->\n\`\`\`json\n${JSON.stringify(design)}\n\`\`\`\n<!-- STYLE_TOKEN_END -->\n`;
const approvals=[{phase_id:'01-content',status:'APPROVED',proof:{kind:'user_message',ref:'user-message:approval-1'}},{phase_id:'02-visual-production',status:'APPROVED',proof:{kind:'user_message',ref:'user-message:approval-2'}}];
const state={format:'zodiac-pipeline-state@2',run_id:'fixture',review_receipts:approvals,phases:{'01-content':{status:'PASS'},'02-visual-production':{status:'PASS'}}};
async function fixture(){
 const root=await mkdtemp(path.join(os.tmpdir(),'zodiac-phase03-src-'));
 await mkdir(path.join(root,'assets','characters'),{recursive:true});await mkdir(path.join(root,'publish'));await mkdir(path.join(root,'.authoring'));
 const voice='Bọ Cạp nói không sao, nhưng lại nhìn mọi người rất kỹ.';
 const src={version:'2.0',video:{width:1080,height:1920,fps:24},assets:{HERO:{category:'character',path:'assets/characters/hero.svg'}},scenes:[{id:'S01',voice,entities:[{id:'hero',initial_state:'idle',states:{idle:{asset:'HERO',visible:true,transform:{x:250,y:230,width:480,height:570}},open:{asset:'HERO',visible:true,transform:{x:250,y:230,width:480,height:570}}}}],events:[{id:'E01',target:'hero',action:'reaction',state_before:'idle',state_after:'open',trigger:{type:'scene_start'},motion:{preset:'state_swap',duration_frames:8}}]}]};
 await writeFile(path.join(root,'production.json'),JSON.stringify(src));await writeFile(path.join(root,'design.md'),style);await writeFile(path.join(root,'narration.txt'),voice+'\n');
 await writeFile(path.join(root,'assets/characters/hero.svg'),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 720"><path d="M0 0H520V720H0Z"/></svg>');
 await writeFile(path.join(root,'publish','publish.json'),JSON.stringify({version:'1.5',platform:'tiktok',source:{narration:'narration.txt',production:'production.json'},caption:'Bọ Cạp nói không sao',hashtags:['#bocap','#bungmoto'],cover:{layout:'tilted_top_hook',identity:{sign_id:'bocap',label:'BỌ CẠP',glyph:'♏'},hook:'Bọ Cạp thật sự nói không sao?',source_scene_id:'S01',visuals:[{entity_id:'hero',state_id:'idle'}]}}));
 await writeFile(path.join(root,'publish','publish-copy.txt'),'COVER IDENTITY: BỌ CẠP\nHOOK: Bọ Cạp thật sự nói không sao?\nTIKTOK CAPTION: Bọ Cạp nói không sao\nHASHTAGS: #bocap #bungmoto');
 await writeFile(path.join(root,'.authoring','pipeline-state.json'),JSON.stringify(state));
 const lock=await buildReviewLock(root,state);await writeFile(path.join(root,'.authoring','phase02-review-lock.json'),JSON.stringify(lock));
 return root;
}
test('production Phase03 executes preflight through archive QC as one sealed job',async()=>{
 const sourceRoot=await fixture(),dest=await mkdtemp(path.join(os.tmpdir(),'zodiac-phase03-output-'));
 try{
  const result=await runPhase03Production({sourceRoot,outputDir:dest,sign:'Bọ Cạp',concept:'Không sao',revision:'1.0'});
  assert.equal(result.ok,true);assert.equal(result.release_level,'PRODUCTION_READY_ZIP');
  assert.ok(result.zip.endsWith('zodiac-bocap-khong-sao.zip'));await access(result.zip);
  const files=await import('node:fs/promises');const names=await files.readdir(dest);
  assert.deepEqual(names,['zodiac-bocap-khong-sao.zip']);
 }finally{await rm(sourceRoot,{recursive:true,force:true});await rm(dest,{recursive:true,force:true});}
});
test('a changed approved source fails before writing ZIP',async()=>{
 const root=await fixture(),dest=await mkdtemp(path.join(os.tmpdir(),'zodiac-phase03-output-'));
 try{await writeFile(path.join(root,'assets/characters/hero.svg'),'<svg><!--tampered--></svg>');
 await assert.rejects(()=>runPhase03Production({sourceRoot:root,outputDir:dest,sign:'Bọ Cạp',concept:'Không sao'}),/REVIEW_SOURCE_CHANGED/);
 assert.deepEqual(await (await import('node:fs/promises')).readdir(dest),[]);
 }finally{await rm(root,{recursive:true,force:true});await rm(dest,{recursive:true,force:true});}
});

test('release to the workspace drive succeeds and never overwrites an existing ZIP',async()=>{
 const sourceRoot=await fixture(),dest=await mkdtemp(new URL('./phase03-output-',import.meta.url));
 try{
  const args={sourceRoot,outputDir:dest,sign:'Bọ Cạp',concept:'Không sao'};
  const result=await runPhase03Production(args),bytes=await readFile(result.zip);
  await assert.rejects(()=>runPhase03Production(args),/PRODUCTION_ZIP_ALREADY_EXISTS/);
  assert.deepEqual(await readFile(result.zip),bytes);
  assert.deepEqual(await (await import('node:fs/promises')).readdir(dest),[path.basename(result.zip)]);
 }finally{await rm(sourceRoot,{recursive:true,force:true});await rm(dest,{recursive:true,force:true});}
});

test('simultaneous releases of one filename allow exactly one writer',async()=>{
 const sourceRoot=await fixture(),dest=await mkdtemp(path.join(os.tmpdir(),'zodiac-phase03-race-'));
 try{
  const args={sourceRoot,outputDir:dest,sign:'Bọ Cạp',concept:'Không sao'};
  const results=await Promise.allSettled([runPhase03Production(args),runPhase03Production(args)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.match(results.find(x=>x.status==='rejected').reason.message,/PRODUCTION_ZIP_ALREADY_EXISTS/);
 }finally{await rm(sourceRoot,{recursive:true,force:true});await rm(dest,{recursive:true,force:true});}
});
