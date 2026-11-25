// Browser fixture transport; actual MP4 decoding, no production approvals or clipboard writes.
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const catalog=JSON.parse(await readFile(new URL('../tools/studio_project/idea_catalog.json',import.meta.url),'utf8'));
const temp=await mkdtemp(path.join(tmpdir(),'zodiac-ideas-video-'));
const mp4=path.join(temp,'review.mp4');
const made=spawnSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=purple:s=160x240:r=15','-t','0.4','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',mp4],{encoding:'utf8'});
assert.equal(made.status,0,made.stderr);
const audioMp4=path.join(temp,'audio-only.mp4');
const audio=spawnSync('ffmpeg',['-v','error','-f','lavfi','-i','anullsrc=r=44100:cl=mono','-t','0.4','-vn','-c:a','aac',audioMp4],{encoding:'utf8'});
assert.equal(audio.status,0,audio.stderr);
const browser=await chromium.launch({executablePath:process.env.STUDIO_BROWSER,headless:true});
try {
 const page=await browser.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/src/backend.ts',async route=>{
  const response=await route.fetch();let source=await response.text();
  const start=source.indexOf('export async function request'),end=source.indexOf('export const backend',start);
  assert.ok(start>=0&&end>start);
  source=source.slice(0,start)+'export async function request(method, params = {}) { return window.ideasFixture(method, params); }\n'+source.slice(end);
  await route.fulfill({response,body:source});
 });
 await page.addInitScript(catalog=>{
  window.copied=[];window.clipboardDenied=false;window.saveDenied=false;window.writes=0;window.extraConcept=false;
  Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{
   if(window.clipboardDenied)throw Error('denied');window.copied.push(text);
  }}});
  window.ideasFixture=(method,p)=>{
   const progress=JSON.parse(localStorage.getItem('fixture-progress')||'[]');
   if(method==='health')return {status:'READY'};
   if(method==='projects.list')return [];
   if(method==='ideas.list'){
    const source=structuredClone(catalog);
    if(window.extraConcept)source.groups[0].concepts.push({id:'love-fixture-new',title:'Concept mới từ agent',direction:'Ví dụ bổ sung động.'});
    return {...source,progress};
   }
   if(method==='ideas.update'){
    if(window.saveDenied)throw Error('Không lưu được fixture');
    window.writes++;const row={...p,updated_at:Date.now()/1000};
    localStorage.setItem('fixture-progress',JSON.stringify([
     ...progress.filter(r=>!(r.concept_id===p.concept_id&&r.sign===p.sign)),
     ...(p.status==='not_started'?[]:[row])
    ]));return row;
   }
   throw Error('Unexpected fixture method '+method);
  };
 },catalog);
 const open=async()=>{
  await page.goto(process.env.STUDIO_URL||'http://127.0.0.1:1420');
  await page.locator('.primary-nav').getByRole('button',{name:'Kế hoạch',exact:true}).click();
  await page.locator('.plan-concept').first().waitFor();
 };
 async function fit(label){
  await page.waitForTimeout(150);
  const result=await page.evaluate(()=>({
   width:document.documentElement.scrollWidth>innerWidth,height:document.documentElement.scrollHeight>innerHeight,
   outside:[...document.querySelectorAll('button,input,select,video,.pagination')].filter(el=>{
    if(el.closest('.plan-list,.plan-detail'))return false;const r=el.getBoundingClientRect();return r.width&&r.height&&(r.bottom>innerHeight+1||r.top< -1||r.right>innerWidth+1||r.left< -1);
   }).map(el=>el.outerHTML.slice(0,100))
  }));
  if(result.height||result.width||result.outside.length)await page.screenshot({path:process.env.TEMP+'/studio-ideas-overflow.png'});
  assert.deepEqual(result,{width:false,height:false,outside:[]},label);
 }
 await open();
 await page.locator('.plan-concept').first().click();
 assert.equal(await page.locator('.plan-sign').count(),12,'Plan screen shows all 12 signs of the chosen concept');
 for(const [width,height]of [[1366,768],[1060,650],[1093,614]]){
  await page.setViewportSize({width,height});await fit('plan '+width);
 }
 await page.locator('.plan-sign').first().getByRole('button',{name:/Copy prompt/}).click();
 assert.match(await page.evaluate(()=>window.copied.at(-1)),/^Dùng plugin @Zodiac-Video-Web/);
 assert.match(await page.locator('[role=status].inline-alert').innerText(),/@Zodiac-Video-Web/);
 assert.equal(await page.evaluate(()=>window.writes),0,'copy must not change progress');
 await page.evaluate(()=>{window.extraConcept=true;window.dispatchEvent(new Event('focus'));});
 await page.getByLabel('Tìm concept',{exact:true}).fill('Concept mới từ agent');
 await page.getByRole('button',{name:/Concept mới từ agent/}).waitFor();
 await page.getByLabel('Tìm concept',{exact:true}).fill('');
 await page.locator('.plan-concept').first().click();
 await page.evaluate(()=>{window.clipboardDenied=true;});
 await page.locator('.plan-sign').first().getByRole('button',{name:/Copy prompt/}).click();
 await page.getByRole('alert').filter({hasText:'Không copy được tự động'}).waitFor();
 await page.locator('.idea-prompt').waitFor();
 await page.evaluate(catalog=>localStorage.setItem('fixture-progress',JSON.stringify(catalog.signs.map(sign=>({concept_id:catalog.groups[0].concepts[0].id,sign,status:'mp4_approved',updated_at:1})))),catalog);
 await page.evaluate(()=>{window.clipboardDenied=false;window.copied=[];});
 await open();await page.locator('.plan-concept').first().click();
 assert.equal(await page.locator('.plan-sign.mp4_approved').count(),12);
 for(const button of await page.locator('.plan-sign').getByRole('button',{name:/Copy prompt/}).all())assert.equal(await button.isDisabled(),true);
 assert.equal(await page.evaluate(()=>window.copied.length),0);await fit('all approved');
 await page.screenshot({path:process.env.TEMP+'/studio-plan-1093.png'});
 assert.deepEqual(errors,[]);
 console.log('PASS: plan screen concept/sign list, copy prompt, dynamic additions on focus, clipboard fallback, all-approved guard; three sizes; fixture transport.');
}finally{await browser.close();await rm(temp,{recursive:true,force:true});}
