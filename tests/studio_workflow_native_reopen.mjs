// Verify persisted real task receipts and MP4 after restarting the dev app on the same store.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const output=path.resolve(process.env.STUDIO_E2E_OUTPUT||'.runtime/workflow-agent-e2e');
const expected=JSON.parse(await readFile(path.join(output,'gui-evidence.json'),'utf8'));
assert.ok(expected.finished_at&&!expected.error,'A completed real GUI run is required');
const browser=await chromium.connectOverCDP(process.env.STUDIO_CDP||'http://127.0.0.1:9227');
const page=browser.contexts()[0].pages().find(p=>p.url().includes('127.0.0.1:1420'));
assert.ok(page,'Native dev app required');
try{
 await page.waitForFunction(id=>document.querySelector('[aria-label="Episode đang làm"]')?.value===id,expected.project,{timeout:60000});
 assert.equal(await page.getByLabel('Episode đang làm',{exact:true}).inputValue(),expected.project,'startup restores episode automatically');
 await page.locator('.editing-workbench').waitFor();
 assert.ok(expected.workbench_context,'run must record actual workbench selection before export');
 await page.waitForFunction(context=>document.querySelector('.visual-scenes button.active')?.dataset.sceneId===context.sceneId && Math.abs(Number(document.querySelector('[aria-label="Vị trí toàn video"]')?.value)-context.timeMs)<=1,expected.workbench_context,{timeout:120000});
 assert.equal(await page.getByLabel('Đối tượng',{exact:true}).inputValue(),expected.workbench_context.entityId);
 const restoredContext={...expected.workbench_context};
 await page.locator('.sidebar-nav').getByRole('button',{name:'Episode',exact:true}).click();
 await page.locator('.workflow-tabs').getByRole('button',{name:'Agent',exact:true}).click();
 await page.locator('.agent-workspace .agent-proposal').getByText(/Đã áp dụng/).waitFor({timeout:60000});
 const receipt=await page.locator('.agent-workspace .agent-proposal').innerText();
 assert.match(receipt,/COMPLETED/);
 await page.locator('.workflow-tabs').getByRole('button',{name:'Xuất & duyệt',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.review-stage video')?.readyState>=1,{},{timeout:60000});
 const video=page.locator('.review-stage video');
 await video.evaluate(v=>{v.muted=true;return v.play();});
 await page.waitForFunction(()=>document.querySelector('.review-stage video')?.currentTime>.5);
 const playback=await video.evaluate(v=>({width:v.videoWidth,height:v.videoHeight,duration:v.duration,currentTime:v.currentTime,muted:v.muted,playing:!v.paused}));
 assert.equal(playback.width,1080);assert.equal(playback.height,1920);assert.equal(playback.duration,expected.playback.duration);
 const exported=await page.locator('.export-path').innerText();
 assert.equal(exported,expected.export_text);
 assert.equal(await page.getByRole('checkbox',{name:'MP4 đã được tôi xem và duyệt',exact:true}).isChecked(),false);
 await page.screenshot({path:path.join(output,'native-reopened.png')});
 await writeFile(path.join(output,'reopen.json'),JSON.stringify({at:new Date().toISOString(),project:expected.project,restored_context:restoredContext,receipt,playback,export_text:exported,human_review:'PENDING'},null,2));
 console.log('PASS: restarted native app restores applied task and exact persisted MP4; no quality approval');
}finally{await browser.close();}
