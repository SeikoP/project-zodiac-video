// Real native transport only. Import an approved handoff and prepare/reuse real voice first.
// Never calls backend APIs or grants listening/creative approvals from automation.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const output=path.resolve(process.env.STUDIO_E2E_OUTPUT||'.runtime/workflow-agent-e2e');
await mkdir(output,{recursive:true});
const browser=await chromium.connectOverCDP(process.env.STUDIO_CDP||'http://127.0.0.1:9227');
const page=browser.contexts()[0].pages().find(p=>p.url().includes('127.0.0.1:1420'));
assert.ok(page,'Real Tauri dev app required');
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const evidence={started_at:new Date().toISOString(),steps:[],human_review:'PENDING',transport:'native Tauri/Rust/Python',voice:'existing real selected takes; see voice-reuse.json'};
let at=Date.now();
async function record(name){
 const now=Date.now();evidence.steps.push({name,seconds:(now-at)/1000});at=now;
 await writeFile(path.join(output,'gui-evidence.json'),JSON.stringify(evidence,null,2));
 console.log(name, evidence.steps.at(-1).seconds+'s');
}
async function tab(name){await page.locator('.workflow-tabs').getByRole('button',{name,exact:true}).click();}
try{
 assert.equal(await page.locator('.sidebar-nav button').count(),3);
 await tab('Giọng đọc');await page.getByRole('button',{name:'Nghe toàn bài & timing',exact:true}).click();
 await page.getByText(/từ có thời gian đo thực tế/).waitFor({timeout:60000});
 await record('voice and measured timing available in GUI');
 await tab('Hình ảnh');
 await page.waitForFunction(()=>document.querySelector('.initial-authoring')||document.querySelector('.visual-scenes button'),{},{timeout:60000});
 const initial=page.locator('.initial-authoring');
 if(await initial.count()){
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
 await page.locator('.visual-stage iframe').waitFor({timeout:120000});
 await record('episode built and real preview opened');
 const selectedScene=await page.locator('.visual-scenes button.active').innerText();
 await tab('Giọng đọc');await tab('Hình ảnh');
 assert.equal(await page.locator('.visual-scenes button.active').innerText(),selectedScene);
 await page.locator('.visual-inspector').getByRole('button',{name:'Agent',exact:true}).click();
 await page.getByLabel('Yêu cầu agent chỉnh cảnh',{exact:true}).fill('Dịch nhân vật chính sang phải 20px ở state ban đầu, giữ mọi thuộc tính khác. Chỉ trả scene.patch.');
 await page.getByRole('button',{name:'Đề xuất chỉnh sửa',exact:true}).click();
 const proposal=page.locator('.visual-inspector .agent-proposal');
 await page.waitForFunction(()=>{const p=document.querySelector('.visual-inspector .agent-proposal');return p&&/COMPLETED|FAILED|CANCELLED/.test(p.innerText)&&/Cảnh/.test(p.innerText);},{},{timeout:200000});
 assert.match(await proposal.innerText(),/COMPLETED/);
 await page.screenshot({path:path.join(output,'scene-proposal.png')});
 await page.getByRole('button',{name:'Xác nhận edit & dựng cảnh',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.visual-editor .voice-progress')?.innerText.includes('COMPLETED'),{},{timeout:120000});
 await record('real scene agent edit confirmed and rebuilt');
 await tab('Xuất & duyệt');
 await page.getByRole('button',{name:'Xuất MP4',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.export-path')&&document.querySelector('.review-stage video')?.readyState>=1,{},{timeout:1200000});
 const video=page.locator('.review-stage video');
 await video.evaluate(v=>{v.muted=true;return v.play();});
 await page.waitForFunction(()=>document.querySelector('.review-stage video')?.currentTime>.5);
 evidence.playback=await video.evaluate(v=>({width:v.videoWidth,height:v.videoHeight,duration:v.duration,currentTime:v.currentTime,muted:v.muted,playing:!v.paused}));
 assert.equal(evidence.playback.width,1080);assert.equal(evidence.playback.height,1920);
 assert.equal(await page.getByRole('checkbox',{name:'MP4 đã được tôi xem và duyệt',exact:true}).isChecked(),false);
 evidence.export_text=await page.locator('.export-path').innerText();
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
