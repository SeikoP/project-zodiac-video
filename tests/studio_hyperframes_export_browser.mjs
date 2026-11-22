// UI transport fixture; verifies actual MP4 decode, never production approval.
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const folder=await mkdtemp(path.join(tmpdir(),'hf-export-ui-')),file=path.join(folder,'sample.mp4');
const made=spawnSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=purple:s=160x240:r=30','-t','0.4','-c:v','libx264','-pix_fmt','yuv420p',file]);assert.equal(made.status,0,made.stderr?.toString());
const bytes=await readFile(file),browser=await chromium.launch({executablePath:process.env.STUDIO_BROWSER,headless:true});
try {
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/mock-export.mp4',route=>route.fulfill({body:bytes,contentType:'video/mp4'}));
 await page.route('**/src/backend.ts*',async route=>{const response=await route.fetch();let text=await response.text();const a=text.indexOf('export async function request'),b=text.indexOf('export const backend',a);text=text.slice(0,a)+'export async function request(method,p={}){return window.exportFixture(method,p);}\n'+text.slice(b);await route.fulfill({response,body:text});});
 await page.addInitScript(()=>{
  const project={project_id:'p1',episode_id:'export-fixture',source_sha256:'a'.repeat(64),revision:1,status:{}};
  const receipt={id:'b'.repeat(32),revision:1,path:'.runtime/export/episode.mp4',sha256:'c'.repeat(64),renderer:'hyperframes@0.9.63',duration_seconds:.4,bytes:10000,human_review:'PENDING',approval_granted:false,url:'/mock-export.mp4',file_path:'E:\\test\\episode.mp4'};
  window.exportCalls=[];window.exportReady=false;window.exportStarted=false;window.copiedPath='';
  Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copiedPath=text;}}});
  window.exportFixture=(method,p)=>{
   window.exportCalls.push({method,p});
   if(method==='health')return {status:'READY'};
   if(method==='ideas.list')return {groups:[{id:'test',title:'Test',concepts:[{id:'test',title:'Test'}]}],signs:['Nhân Mã'],progress:[]};
   if(method==='projects.list')return [project];
   if(method==='projects.open'||method==='projects.get')return project;
   if(method.startsWith('events.'))return [];
   if(method==='assets.gallery')return {items:[],themes:[]};
   if(method==='voice.open')return {assembly:null};
   if(method==='video.get')return {...receipt,id:window.newExport?'d'.repeat(32):receipt.id,sha256:window.newExport?'e'.repeat(64):receipt.sha256,stale:!!window.voiceChanged};
   if(method==='video.export')window.exportStarted=true;
   if(method==='visual.open'||method==='video.export')return {revision:1,theme:'light',intent:{scenes:[{id:'s01',semantic_goal:'Test export',entities:[{id:'actor',initial_state:'idle',states:{idle:{asset:'a',transform:{x:0,y:0,width:300,height:500}}}}],events:[]}]},build:{id:'',revision:1,scenes:[],cache:{reused:0,rebuilt:0},resources:{wall_ms:1,peak_rss_bytes:1},renderer_parity:'PENDING'},events:[],stale_preview:!!window.voiceChanged,export:window.exportReady?{...receipt,id:window.newExport?'d'.repeat(32):receipt.id}:undefined,job:window.exportStarted?{id:'job',action:'export',revision:1,status:window.exportReady?'COMPLETED':'RUNNING',render_percent:32,ready_scenes:[],total:1,message:'HyperFrames capture',error:null}:null};
   throw Error('Unexpected method '+method);
  };
 });
 await page.goto(process.env.STUDIO_URL||'http://127.0.0.1:1420');
 await page.locator('.workflow-tabs').getByRole('button',{name:'Xuất & duyệt',exact:true}).click();
 await page.getByRole('button',{name:'Xuất MP4',exact:true}).click();
 await page.getByText(/HyperFrames capture · RUNNING · 32%/).waitFor();
 assert.equal(await page.getByRole('button',{name:'Xuất MP4',exact:true}).isDisabled(),true);
 await page.evaluate(()=>{window.exportReady=true;});
 await page.waitForFunction(()=>document.querySelector('.review-stage video')?.readyState>=1);
 for(const [width,height]of [[1366,768],[1060,650],[1093,614]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(100);
  assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('button,video,.pagination')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.height&&(r.bottom>innerHeight+1||r.right>innerWidth+1||r.left<0);}).map(el=>el.outerHTML.slice(0,90))),[]);
 }
 await page.getByRole('button',{name:'Copy đường dẫn MP4',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.copiedPath),'E:\\test\\episode.mp4');
 await page.getByLabel('Concept của MP4',{exact:true}).selectOption('test');
 await page.getByLabel('Cung của MP4',{exact:true}).selectOption('Nhân Mã');
 await page.getByLabel('Mở MP4',{exact:true}).setInputFiles(file);
 const approval=page.getByRole('checkbox',{name:'MP4 đã được tôi xem và duyệt',exact:true});
 await page.waitForFunction(()=>!document.querySelector('.review-approval input')?.disabled);
 await page.evaluate(()=>{window.newExport=true;});
 await page.waitForFunction(()=>document.querySelector('.export-path details')?.textContent.includes('e'.repeat(64)));
 assert.equal(await approval.isDisabled(),false,'new export must preserve readiness of an opened local video');
 await page.getByRole('button',{name:'Dùng MP4 của episode',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.review-stage video')?.getAttribute('src')==='/mock-export.mp4');
 await page.waitForFunction(()=>!document.querySelector('.review-approval input')?.disabled);
 await page.evaluate(()=>{window.voiceChanged=true;});
 await page.locator('.export-path').getByText(/Nguồn đã thay đổi/).waitFor({timeout:7000});
 const calls=await page.evaluate(()=>window.exportCalls);
 assert.equal(calls.filter(c=>c.method==='video.export').length,1);
 assert.equal(calls.filter(c=>/confirm|ideas.update|visual.command/.test(c.method)).length,0);
 assert.deepEqual(errors,[]);console.log('PASS: HyperFrames export progress, MP4 playback/path, three compact sizes, no approval writes (fixture transport).');
}finally{await browser.close();await rm(folder,{recursive:true,force:true});}
