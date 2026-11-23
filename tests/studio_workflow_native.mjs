// Real native transport only. Import an approved handoff and prepare/reuse real voice first.
// Never calls backend APIs or grants listening/creative approvals from automation.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const output=path.resolve(process.env.STUDIO_E2E_OUTPUT||'.runtime/workflow-agent-e2e');
await mkdir(output,{recursive:true});
const browser=await chromium.connectOverCDP(process.env.STUDIO_CDP||'http://127.0.0.1:9227');
const page=browser.contexts()[0].pages().find(p=>p.url().includes('127.0.0.1:1420'));
assert.ok(page,'Real Tauri dev app required');
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const evidence={started_at:new Date().toISOString(),steps:[],human_review:'PENDING',transport:'native Tauri/Rust/Python',voice:process.env.STUDIO_E2E_GENERATE_VOICE==='1'?'fresh real TTS and measured ASR requested':'existing real selected takes; reused-audio iteration'};
let at=Date.now();
async function record(name){
 const now=Date.now();evidence.steps.push({name,seconds:(now-at)/1000});at=now;
 await writeFile(path.join(output,'gui-evidence.json'),JSON.stringify(evidence,null,2));
 console.log(name, evidence.steps.at(-1).seconds+'s');
}
async function tab(name){
 let target=page.locator('.workflow-tabs').getByRole('button',{name,exact:true});
 const action=name==='Giọng đọc'?'Mở giọng đọc':name==='Xuất & duyệt'?'Xuất video':null;
 if(action)target=target.or(page.getByRole('button',{name:action,exact:true}));
 await target.filter({visible:true}).first().click({timeout:120000});
}
try{
 await page.locator('.sidebar-nav button').first().waitFor({timeout:60000});
 if(process.env.STUDIO_E2E_IMPORT) {
  assert.ok(process.env.STUDIO_NATIVE_PID,'Target native PID is required for file-dialog ownership');
  const child=spawn(process.env.STUDIO_PYTHON||'python',['tests/studio_native_import.py',process.env.STUDIO_E2E_IMPORT,process.env.STUDIO_NATIVE_PID],{stdio:'inherit'});
  const dialog=new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Native file dialog failed '+code)));});
  await page.getByRole('button',{name:'Nhập episode',exact:true}).click();await dialog;
  await page.waitForFunction(()=>document.querySelector('[aria-label="Episode đang làm"]')?.value,{},{timeout:120000});
  await record('approved handoff imported through native file dialog');
 }
 assert.equal(await page.locator('.sidebar-nav button').count(),3);
 if(process.env.STUDIO_E2E_GENERATE_VOICE==='1') {
  await tab('Giọng đọc');
  const generate=page.getByRole('button',{name:'Tạo audio còn thiếu',exact:true});await generate.waitFor({timeout:60000});
  if(await generate.isEnabled()) {
   const previous=await page.locator('.voice-job').getAttribute('data-job-id').catch(()=>null);
   await generate.click();
   await page.waitForFunction(id=>{const e=document.querySelector('.voice-job');return e?.dataset.jobId!==id && /COMPLETED|REVIEW|FAILED/.test(e?.textContent||'');},previous,{timeout:1800000});
   assert.match(await page.locator('.voice-workspace .voice-job').innerText(),/COMPLETED/);
  }
  await record('fresh real speech units available; successful takes retained across retries');
  await page.getByRole('button',{name:'Nghe toàn bài & timing',exact:true}).click();
  await page.getByRole('button',{name:'Ghép audio đã chọn',exact:true}).click();
  const align=page.getByRole('button',{name:'Đo timing bằng ASR',exact:true});await align.waitFor();
  const previous=await page.locator('.voice-job').getAttribute('data-job-id').catch(()=>null);
  await align.click();
  await page.waitForFunction(id=>{const e=document.querySelector('.voice-job');return e?.dataset.jobId!==id && /COMPLETED|REVIEW|FAILED/.test(e?.textContent||'');},previous,{timeout:1800000});
  assert.match(await page.locator('.voice-workspace .voice-job').innerText(),/COMPLETED/);
  await record('fresh selected voice assembled and actual ASR measured via GUI');
 }

 await tab('Giọng đọc');await page.getByRole('button',{name:'Nghe toàn bài & timing',exact:true}).click();
 await page.getByText(/từ có thời gian đo thực tế/).waitFor({timeout:60000});
 await record('voice and measured timing available in GUI');
 await tab('Hình ảnh');
 await page.waitForFunction(()=>document.querySelector('.initial-authoring')||document.querySelector('.visual-scenes button'),{},{timeout:60000});
 const initial=page.locator('.initial-authoring');
 if(await initial.count()){
  if(process.env.STUDIO_INITIAL_DIRECTION) await page.getByLabel('Yêu cầu agent soạn hình ảnh',{exact:true}).fill(process.env.STUDIO_INITIAL_DIRECTION);
  await initial.getByRole('button',{name:'Soạn bản dựng ban đầu',exact:true}).click({timeout:60000});
  await initial.getByRole('button',{name:'Dừng agent',exact:true}).waitFor({timeout:30000});
  await tab('Giọng đọc');await tab('Hình ảnh');
  await page.waitForFunction(()=>{const p=document.querySelector('.initial-authoring .agent-proposal');return p&&/COMPLETED|FAILED|CANCELLED/.test(p.innerText);},{},{timeout:420000});
  assert.match(await initial.locator('.agent-proposal').innerText(),/COMPLETED/);
  await page.screenshot({path:path.join(output,'initial-proposal.png')});
  await initial.getByRole('button',{name:'Áp dụng bản dựng đề xuất',exact:true}).click();
  await initial.waitFor({state:'detached',timeout:60000});
  await record('real initial agent proposal confirmed in GUI');
 }
 await page.getByRole('button',{name:'Dựng cả episode',exact:true}).click();
 await page.locator('.visual-stage iframe:visible').waitFor({timeout:120000});
 await record('episode built and real preview opened');
 const scrubber=page.getByRole('slider',{name:'Vị trí toàn video',exact:true});
 const total=Number(await scrubber.getAttribute('max'));
 const boundary=await page.locator('.timeline-scene-track button').nth(1).evaluate((b,total)=>parseFloat(b.style.left)/100*total,total);
 await scrubber.fill(String(Math.max(0,Math.floor(boundary-500))));
 await page.waitForFunction(()=>!document.querySelector('[aria-label="Phát toàn video"]')?.disabled,{},{timeout:120000});
 await page.locator('.visual-stage audio').evaluate(a=>{a.muted=true;window.nativePauseCount=0;a.addEventListener('pause',()=>window.nativePauseCount++);});
 await page.getByRole('button',{name:'Phát toàn video',exact:true}).click();
 await page.waitForFunction(b=>Number(document.querySelector('[aria-label="Vị trí toàn video"]').value)>b+700,boundary,{timeout:20000});
 evidence.boundary_playback={boundary_ms:boundary,pauses:await page.evaluate(()=>window.nativePauseCount)};
 assert.equal(evidence.boundary_playback.pauses,0,'actual voice must not pause at a scene boundary');
 await page.getByRole('button',{name:'Tạm dừng video',exact:true}).click();
 evidence.timeline_audio=await page.locator('.visual-stage audio').evaluate(a=>({duration:a.duration,currentTime:a.currentTime,paused:a.paused,muted:a.muted}));
 assert.ok(evidence.timeline_audio.duration>0 && evidence.timeline_audio.currentTime>0);
 await scrubber.fill(String(total-600));
 await page.waitForFunction(()=>!document.querySelector('[aria-label="Phát toàn video"]')?.disabled,{},{timeout:120000});
 await page.getByRole('button',{name:'Phát toàn video',exact:true}).click();
 await page.waitForFunction(total=>Number(document.querySelector('[aria-label="Vị trí toàn video"]').value)===total && !!document.querySelector('[aria-label="Phát toàn video"]'),total,{timeout:20000});
 await page.getByRole('button',{name:'Phát toàn video',exact:true}).click();
 await page.waitForFunction(()=>{const n=Number(document.querySelector('[aria-label="Vị trí toàn video"]').value);return n>100 && n<2000;},{},{timeout:20000});
 await page.getByRole('button',{name:'Tạm dừng video',exact:true}).click();
 await scrubber.fill('0');
 await record('real voice crossed scene boundary continuously, ended and replayed from zero');
 const selectedScene=await page.locator('.visual-scenes button.active').innerText();
 await tab('Giọng đọc');await tab('Hình ảnh');
 assert.equal(await page.locator('.visual-scenes button.active').innerText(),selectedScene);
 await page.locator('.visual-inspector').getByRole('button',{name:'Agent',exact:true}).click();
 const targetEntity=await page.getByLabel('Đối tượng',{exact:true}).inputValue();
 const targetState=await page.getByLabel('Trạng thái',{exact:true}).inputValue();
 const originalX=Number(await page.getByLabel('Vị trí ngang',{exact:true}).inputValue());
 await page.getByLabel('Yêu cầu agent chỉnh cảnh',{exact:true}).fill(`Đối tượng ${targetEntity}, trạng thái ${targetState}: đặt x bằng ${originalX+20}; giữ mọi thuộc tính khác. Chỉ trả scene.patch.`);
 await page.getByRole('button',{name:'Đề xuất chỉnh sửa',exact:true}).click();
 const proposal=page.locator('.visual-inspector .agent-proposal');
 await page.waitForFunction(()=>{const p=document.querySelector('.visual-inspector .agent-proposal');return p&&/COMPLETED|FAILED|CANCELLED/.test(p.innerText)&&/Cảnh/.test(p.innerText);},{},{timeout:200000});
 assert.match(await proposal.innerText(),/COMPLETED/);
 await page.screenshot({path:path.join(output,'scene-proposal.png')});
 await page.getByRole('button',{name:'Xác nhận edit & dựng cảnh',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.visual-editor .voice-progress')?.innerText.includes('COMPLETED'),{},{timeout:120000});
 await record('real scene agent edit confirmed and rebuilt');
 await page.locator('.visual-inspector').getByRole('button',{name:'Đối tượng',exact:true}).click();
 assert.equal(Number(await page.getByLabel('Vị trí ngang',{exact:true}).inputValue()),originalX+20);
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await page.waitForFunction(x=>Number(document.querySelector('.visual-transform input')?.value)===x,originalX,{timeout:120000});
 await page.waitForFunction(()=>!document.querySelector('.visual-toolbar .primary-btn')?.disabled,{},{timeout:120000});
 await page.getByRole('button',{name:'Redo',exact:true}).click();
 await page.waitForFunction(x=>Number(document.querySelector('.visual-transform input')?.value)===x,originalX+20,{timeout:120000});
 await page.waitForFunction(()=>!document.querySelector('.visual-toolbar .primary-btn')?.disabled,{},{timeout:120000});
 await record('scene edit undo and redo preserved canonical source through GUI');
 await page.locator('.timeline-scene-track button').nth(2).click();
 await page.locator('.visual-stage iframe:visible').waitFor({timeout:120000});
 evidence.workbench_context=await page.evaluate(()=>({sceneId:document.querySelector('.visual-scenes button.active')?.dataset.sceneId,entityId:document.querySelector('.visual-inspector select')?.value,timeMs:Number(document.querySelector('[aria-label="Vị trí toàn video"]')?.value)}));
 await tab('Xuất & duyệt');
 const previousOutput=await page.locator('.export-path>small').count() ? await page.locator('.export-path>small').first().textContent() : null;
 await page.getByRole('button',{name:'Xuất MP4',exact:true}).click();
 await page.waitForFunction(previous=>{
  const status=document.querySelector('.episode-export [role="status"]')?.textContent||'';
  const output=document.querySelector('.export-path>small')?.textContent||'';
  return /COMPLETED/.test(status) && output!==previous && /Đúng bản xuất hiện tại/.test(output) && document.querySelector('.review-stage video')?.readyState>=1;
 },previousOutput,{timeout:1200000});
 const video=page.locator('.review-stage video');
 await video.evaluate(v=>{v.muted=true;return v.play();});
 await page.waitForFunction(()=>document.querySelector('.review-stage video')?.currentTime>.5);
 evidence.playback=await video.evaluate(v=>({width:v.videoWidth,height:v.videoHeight,duration:v.duration,currentTime:v.currentTime,muted:v.muted,playing:!v.paused}));
 assert.equal(evidence.playback.width,1080);assert.equal(evidence.playback.height,1920);
 assert.equal(await page.getByRole('checkbox',{name:'MP4 đã được tôi xem và duyệt',exact:true}).isChecked(),false);
 evidence.export_text=await page.locator('.export-path').innerText();
 evidence.export_sha256=(await page.locator('.export-path details').textContent()).match(/[a-f0-9]{64}/)?.[0];
 assert.ok(evidence.export_sha256,'current export receipt hash required');
 evidence.project=await page.getByLabel('Episode đang làm',{exact:true}).inputValue();
 await page.screenshot({path:path.join(output,'native-final.png')});
 await record('MP4 exported and played in native GUI without quality approval');
 assert.deepEqual(errors,[]);
 evidence.finished_at=new Date().toISOString();evidence.wall_seconds=evidence.steps.reduce((n,s)=>n+s.seconds,0);
 await writeFile(path.join(output,'gui-evidence.json'),JSON.stringify(evidence,null,2));
 console.log('NATIVE GUI E2E PASS; human quality gates PENDING');
}catch(error){
 evidence.error=String(error);await writeFile(path.join(output,'gui-evidence.json'),JSON.stringify(evidence,null,2));
 await page.screenshot({path:path.join(output,'native-failure.png')}).catch(()=>{});throw error;
}finally{process.exitCode=evidence.error?1:0;await browser.close();}
