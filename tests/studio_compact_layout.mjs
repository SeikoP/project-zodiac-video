// Browser-only layout fixtures; no production commands or approvals are sent.
// Run with PLAYWRIGHT_MODULE and STUDIO_BROWSER pointing to local installations.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import {installWorkbenchFixture} from './studio_workbench_fixture.mjs';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ executablePath: process.env.STUDIO_BROWSER, headless: true });
try {
 const page = await browser.newPage();
 const failures = [];
 page.on('pageerror', error => failures.push(error.message));
 await installWorkbenchFixture(page);
 async function stage(label) {
  const id={'Giọng đọc':'voice','Hình ảnh':'visual','Xuất MP4':'export'}[label];
  const row=page.locator(`.step-row[data-node-id="${id}"]`);
  const phase=page.locator('.step-phase').filter({has:row});
  if(!await phase.evaluate(el=>el.open)) await phase.locator(':scope > summary').click();
  await row.locator('.step-main').click();
 }
 async function fit(label) {
  await page.waitForTimeout(180);
  const overflow = await page.evaluate(() => {
   const root=document.documentElement;
   const outside=[...document.querySelectorAll('button,input,select,textarea,.pagination,.visual-viewport')].filter(el=>{
    const r=el.getBoundingClientRect();
    if(!r.width||!r.height||!el.checkVisibility())return false;
    let top=r.top,bottom=r.bottom,left=r.left,right=r.right;
    for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement){
     const style=getComputedStyle(p),box=p.getBoundingClientRect();
     if(/auto|scroll|hidden|clip/.test(style.overflowY)){top=Math.max(top,box.top);bottom=Math.min(bottom,box.bottom);}
     if(/auto|scroll|hidden|clip/.test(style.overflowX)){left=Math.max(left,box.left);right=Math.min(right,box.right);}
    }
    return bottom>top&&right>left&&(bottom>innerHeight+1||right>innerWidth+1||left< -1);
   }).map(el=>`${el.tagName}.${el.className}: ${Math.round(el.getBoundingClientRect().bottom)}`);
   return {width:root.scrollWidth>innerWidth,height:root.scrollHeight>innerHeight,outside};
  });
  if(overflow.width || overflow.height || overflow.outside.length) {
    await page.screenshot({path:`${process.env.TEMP}/studio-layout-failed.png`});
    console.log(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.height&&r.bottom>innerHeight;}).slice(-12).map(e=>({tag:e.tagName,cls:e.className,bottom:e.getBoundingClientRect().bottom,height:e.getBoundingClientRect().height}))));
  }
  assert.deepEqual(overflow,{width:false,height:false,outside:[]},label);
 }
 await page.goto(process.env.STUDIO_URL || 'http://127.0.0.1:1420');
 await page.locator('.primary-nav').getByRole('button',{name:'Episode',exact:true}).click();
 await page.locator('.workflow-tabs').getByRole('button',{name:'Danh sách',exact:true}).click();
 await page.waitForSelector('.episode-item');
 for(const [width,height] of [[1366,768],[1060,650],[1093,614]]) {
  await page.setViewportSize({width,height});
  assert.equal(await page.locator('.primary-nav button').count(),3);
  for(const view of ['Danh sách','Kho tài nguyên','Nhật ký','Agent','Giọng đọc','Hình ảnh']) {
   if(view==='Kho tài nguyên') await page.locator('.primary-nav').getByRole('button',{name:'Tài nguyên',exact:true}).click();
   else if(view==='Giọng đọc'||view==='Hình ảnh') {
    await page.locator('.primary-nav').getByRole('button',{name:'Episode',exact:true}).click();
    await stage(view);
   } else {
    if(!await page.locator('.workflow-tabs').getByRole('button',{name:view,exact:true}).isVisible()) await page.locator('.primary-nav').getByRole('button',{name:'Episode',exact:true}).click();
    await page.locator('.workflow-tabs').getByRole('button',{name:view,exact:true}).click();
   }
   await fit(`${width}x${height} ${view}`);
   if(view==='Danh sách') {
    await page.getByRole('button',{name:'Episode: trang sau',exact:true}).click();
    assert.match(await page.locator('.episode-list').innerText(),/p4/);
    await page.getByRole('button',{name:'Ghi chú & hoạt động',exact:true}).click(); await fit('notes');
    await page.getByRole('button',{name:'Episode & trạng thái',exact:true}).click();
    await page.getByRole('button',{name:'Mở bước Giọng đọc',exact:true}).click();
    assert.equal(await page.locator('.production-workspace').getAttribute('data-stage'),'voice');
    await page.locator('.workflow-tabs').getByRole('button',{name:'Danh sách',exact:true}).click();
   }
   if(view==='Giọng đọc') {
    for(const tab of ['Nghe toàn bài & timing','Thiết lập giọng','Từng đoạn']) {
     await page.getByRole('button',{name:tab,exact:true}).click(); await fit(`voice ${tab}`);
     if(tab==='Nghe toàn bài & timing') { await page.locator('.voice-timing summary').click(); await fit('timing pages'); }

    }
   }
   if(view==='Hình ảnh') {
    await page.locator('.episode-timeline .timeline-scene-track button').first().waitFor({timeout:5000});
    await page.locator('.episode-timeline').getByRole('button',{name:/Cảnh 4 ·/}).click();
    await page.locator('.episode-timeline').getByRole('button',{name:/Cảnh 4 ·/}).and(page.locator('[aria-pressed=true]')).waitFor();
    await page.getByRole('button',{name:'Kho hình ảnh',exact:true}).click();
    await page.locator('.gallery-card').first().waitFor(); await fit('embedded gallery');
    await page.getByRole('button',{name:'Kho hình ảnh',exact:true}).click();
    for(const tab of ['Sự kiện','Hình ảnh','Sửa cảnh','Đối tượng']) {
     await page.locator('.visual-inspector').getByRole('button',{name:tab,exact:true}).click(); await fit(`inspector ${tab}`);
     if(tab==='Sự kiện') {
      await page.getByRole('button',{name:'Chỉnh nhịp diễn theo lời kể',exact:true}).click(); await fit('acting editor');
      await page.getByRole('button',{name:'Sự kiện diễn xuất: trang sau',exact:true}).click(); await fit('acting event pages');
      await page.getByRole('button',{name:'Đóng',exact:true}).click();
     }
     if(tab==='Hình ảnh') { await page.getByRole('button',{name:'Tìm bundle phù hợp',exact:true}).click(); await fit('candidates'); assert.match(await page.locator('.visual-candidates').filter({visible:true}).innerText(),/phạm vi quét giới hạn/); }

    }
    if(!await page.getByRole('button',{name:'Nguồn Visual Intent',exact:true}).isVisible()) await page.getByRole('button',{name:'Chi tiết',exact:true}).click();
    await page.getByRole('button',{name:'Nguồn Visual Intent',exact:true}).click(); await fit('source');
    await page.getByRole('button',{name:'Đọc nguồn hiện tại',exact:true}).click();
    const textBefore = await page.getByRole('textbox',{name:'Canonical Visual Intent',exact:true}).inputValue();
    assert.ok(textBefore.length > 100);
    await page.getByRole('button',{name:'Canonical Visual Intent: trang sau',exact:true}).click();
    assert.notEqual(await page.getByRole('textbox',{name:'Canonical Visual Intent',exact:true}).inputValue(),textBefore);
    await fit('source pages');
    const sourceBox=page.getByRole('textbox',{name:'Canonical Visual Intent',exact:true});
    if(await sourceBox.evaluate(el=>el.scrollHeight>el.clientHeight)) console.log('SOURCE_OVERFLOW',await sourceBox.evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight,text:el.value,root:el.parentElement.getBoundingClientRect().height,font:getComputedStyle(el).font,padding:getComputedStyle(el).padding})));
    assert.equal(await sourceBox.evaluate(el=>el.scrollHeight>el.clientHeight),false,'source page must not scroll');
    await page.getByRole('button',{name:'Soạn nguồn thay thế',exact:true}).click();
    await page.getByRole('textbox',{name:'Canonical Visual Intent',exact:true}).fill('"' + 'nguồn thay thế\\n'.repeat(100) + '"');
    await fit('replacement source');


    await page.getByRole('button',{name:'Nguồn Visual Intent',exact:true}).click();
    await page.getByRole('button',{name:'Hoạt động chỉnh sửa và build',exact:true}).click(); await fit('build log');
    await page.getByRole('button',{name:'Đóng nhật ký',exact:true}).click();
   }
  }
  await page.screenshot({path:`${process.env.TEMP}/studio-compact-${width}.png`});
 }
 await stage('Giọng đọc');
 await page.locator('.voice-unit-list .voice-unit').first().waitFor();
 await page.evaluate(()=>{window.slowVoice=true;});
 await page.waitForFunction(()=>window.voicePending===1);
 await page.waitForTimeout(3200);
 assert.equal(await page.evaluate(()=>window.voicePeak),1,'slow reads must not overlap');
 await page.locator('.voice-unit-list .voice-unit').nth(7).click();
 const activeUnit=()=>page.locator('.voice-unit-list .voice-unit[aria-pressed=true]').innerText();
 const selectedUnit=await activeUnit();
 await page.locator('.primary-nav').getByRole('button',{name:'Tài nguyên',exact:true}).click();
 const reads=await page.evaluate(()=>window.voiceReads);
 await page.waitForTimeout(3500);
 assert.equal(await page.evaluate(()=>window.voiceReads),reads,'hidden Voice Lab must stop polling');
 await page.evaluate(()=>{window.slowVoice=false;});
 await page.locator('.primary-nav').getByRole('button',{name:'Episode',exact:true}).click();
 assert.equal(await activeUnit(),selectedUnit,'returning to the episode must retain voice selection');
 assert.deepEqual(failures,[]);
 console.log('PASS: Graph workspace and episode/resources/activity/agent views, inspector/voice/source/log tabs, bounded scrolling and pagination, three viewport sizes; fixture-only backend.');
} finally { await browser.close(); }
