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
  await page.locator('.sidebar-nav').getByRole('button',{name:'Kế hoạch',exact:true}).click();
  await page.locator('.idea-card').first().waitFor();
 };
 async function fit(label){
  await page.waitForTimeout(150);
  const result=await page.evaluate(()=>({
   width:document.documentElement.scrollWidth>innerWidth,height:document.documentElement.scrollHeight>innerHeight,
   outside:[...document.querySelectorAll('button,input,select,video,.pagination')].filter(el=>{
    const r=el.getBoundingClientRect();return r.width&&r.height&&(r.bottom>innerHeight+1||r.top< -1||r.right>innerWidth+1||r.left< -1);
   }).map(el=>el.outerHTML.slice(0,100))
  }));
  if(result.height||result.width||result.outside.length)await page.screenshot({path:process.env.TEMP+'/studio-ideas-overflow.png'});
  assert.deepEqual(result,{width:false,height:false,outside:[]},label);
 }
 await open();
 for(const [width,height]of [[1366,768],[1060,650],[1093,614]]){
  await page.setViewportSize({width,height});await fit('library '+width);
  await page.getByRole('button',{name:'Mở rộng menu',exact:true}).click();await fit('expanded library '+width);
  await page.getByRole('button',{name:'Thu gọn menu',exact:true}).click();
  await page.locator('.idea-card').first().click();await fit('concept detail '+width);
  assert.match(await page.evaluate(()=>window.copied.at(-1)),/^Dùng plugin @Zodiac-Video-Web/);
  assert.match(await page.locator('.ideas-feedback').innerText(),/@Zodiac-Video-Web/);
  assert.equal(await page.locator('.ideas-detail select,.ideas-detail input').count(),0,'Ideas should have no editing controls');
  await page.getByRole('button',{name:'Xem nội dung prompt',exact:true}).click();await fit('prompt '+width);
  await page.getByRole('button',{name:'Danh sách concept',exact:true}).click();
 }
 assert.equal(await page.evaluate(()=>window.writes),0,'copy must not change progress');
 await page.evaluate(()=>{window.extraConcept=true;window.dispatchEvent(new Event('focus'));});
 await page.getByLabel('Tìm concept',{exact:true}).fill('Concept mới từ agent');
 await page.getByRole('button',{name:/Concept mới từ agent/}).waitFor();
 await page.getByLabel('Tìm concept',{exact:true}).fill('');
 await page.locator('.idea-card').first().click();
 await page.locator('.ideas-detail').getByRole('button',{name:'Xem & duyệt MP4',exact:true}).click();
 const approval=page.getByRole('checkbox',{name:'MP4 đã được tôi xem và duyệt',exact:true});
 await approval.waitFor();assert.equal(await approval.isDisabled(),true);
 assert.equal(await page.getByLabel('Concept của MP4',{exact:true}).inputValue(),'love-feeling');
 await page.getByLabel('Cung của MP4',{exact:true}).selectOption('Bạch Dương');
 await page.getByLabel('Mở MP4',{exact:true}).setInputFiles(mp4);
 await page.waitForFunction(()=>document.querySelector('video')?.readyState>=1);
 await page.locator('video').evaluate(v=>v.play());
 await page.waitForFunction(()=>document.querySelector('video')?.ended);
 assert.equal(await page.evaluate(()=>window.writes),0,'opening and playing video must not approve it');
 for(const [width,height]of [[1366,768],[1060,650],[1093,614]]){
  await page.setViewportSize({width,height});await fit('MP4 review '+width);
  await page.getByRole('button',{name:'Mở rộng menu',exact:true}).click();await fit('expanded MP4 review '+width);
  await page.getByRole('button',{name:'Thu gọn menu',exact:true}).click();
 }
 await approval.check();await page.getByRole('status').filter({hasText:'Đã duyệt MP4 cho Bạch Dương'}).waitFor();
 await page.evaluate(()=>{window.saveDenied=true;});await approval.click();
 await page.getByRole('alert').filter({hasText:'Không lưu được fixture'}).waitFor();assert.equal(await approval.isChecked(),true);
 await page.evaluate(()=>{window.saveDenied=false;});
 await page.getByLabel('Mở MP4',{exact:true}).setInputFiles({name:'broken.mp4',mimeType:'video/mp4',buffer:Buffer.from('not a video')});
 await page.getByRole('alert').filter({hasText:'Không phát được MP4'}).waitFor();assert.equal(await approval.isDisabled(),true);
 await page.getByLabel('Mở MP4',{exact:true}).setInputFiles(audioMp4);
 await page.waitForFunction(()=>document.querySelector('video')?.readyState>=1);
 assert.equal(await approval.isDisabled(),true,'audio-only MP4 must not enable video approval');
 await page.locator('.sidebar-nav').getByRole('button',{name:'Kế hoạch',exact:true}).click();await page.locator('.idea-card').first().click();
 assert.ok((await page.evaluate(()=>window.copied.at(-1))).includes('MP4 đã duyệt: Bạch Dương'));
 assert.equal(await page.locator('.idea-sign.mp4_approved').count(),1);
 await page.evaluate(()=>{window.clipboardDenied=true;});await page.getByRole('button',{name:'Copy prompt',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Không copy được clipboard'}).waitFor();
 await page.getByRole('button',{name:'Chọn toàn bộ prompt để Ctrl+C',exact:true}).click();
 const manual=await page.locator('.idea-prompt').evaluate(el=>{
  const data=new DataTransfer();el.dispatchEvent(new ClipboardEvent('copy',{clipboardData:data,bubbles:true,cancelable:true}));return data.getData('text/plain');
 });assert.ok(manual.endsWith('trong Studio.'));
 await page.getByRole('button',{name:'Danh sách concept',exact:true}).click();
 await page.getByLabel('Nhóm ý tưởng',{exact:true}).selectOption('healing');
 await page.locator('.idea-card').first().waitFor();await fit('healing group');
 await page.getByLabel('Nhóm ý tưởng',{exact:true}).selectOption('everyday');
 await page.getByRole('button',{name:'Concept: trang sau',exact:true}).click();
 assert.match(await page.locator('.ideas-catalog').innerText(),/tức giận nhưng phải lịch sự/);
 await page.evaluate(catalog=>localStorage.setItem('fixture-progress',JSON.stringify(catalog.signs.map(sign=>({concept_id:catalog.groups[0].concepts[0].id,sign,status:'mp4_approved',updated_at:1})))),catalog);
 await open();await page.locator('.idea-card').first().click();
 assert.equal(await page.getByRole('button',{name:'Copy prompt',exact:true}).isDisabled(),true);
 assert.equal(await page.evaluate(()=>window.copied.length),0);await fit('all approved');
 await page.getByRole('button',{name:'Danh sách concept',exact:true}).click();
 await page.screenshot({path:process.env.TEMP+'/studio-ideas-simple-1093.png'});
 assert.deepEqual(errors,[]);
 console.log('PASS: simple library/detail, dynamic additions on focus, MP4 decode/playback/manual approval, failed save, invalid MP4, clipboard fallback, persistence, all-complete guard; compact/expanded at 3 sizes; fixture transport.');
}finally{await browser.close();await rm(temp,{recursive:true,force:true});}
