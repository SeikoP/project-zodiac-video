// Browser-only layout fixtures; no production commands or approvals are sent.
// Run with PLAYWRIGHT_MODULE and STUDIO_BROWSER pointing to local installations.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ executablePath: process.env.STUDIO_BROWSER, headless: true });
try {
 const page = await browser.newPage();
 const failures = [];
 page.on('pageerror', error => failures.push(error.message));
  await page.route('**/src/backend.ts*', async route => {
  const response = await route.fetch(); let source = await response.text();
  const start = source.indexOf('export async function request');
  const end = source.indexOf('export const backend', start);
  source = source.slice(0, start) + `export async function request(method, params = {}) { return window.layoutFixture(method, params); }\n` + source.slice(end);
  await route.fulfill({ response, body: source });
 });
 await page.addInitScript(() => {
  const project = { project_id:'p1', episode_id:'test-episode', display_title:'Episode kiểm tra bố cục', source_sha256:'a'.repeat(64), revision:1, status:{content:'APPROVED',voice:'TECHNICAL_VALID',visual:'UNKNOWN',video:'UNKNOWN',published:'UNKNOWN'} };
  const scenes = Array.from({length:12}, (_,i) => ({id:`s${i+1}`, semantic_goal:'Phản ứng nhân vật trước tình huống bất ngờ', entities:[{id:'actor',kind:'character',initial_state:'normal',states:{normal:{asset:'gemini',transform:{x:50,y:50,width:300,height:600}}}}],events:Array.from({length:8},(_,j)=>({id:`e${j}`,target:'actor',state_before:'normal',state_after:'normal',trigger:{type:'voice',text:'Câu nói'}}))}));
  const take = {take_id:'t1',wav_sha256:'a'.repeat(64),duration_seconds:2,peaks:[.2,.8,.4],warnings:[]};
  const voice = {project_id:'p1',revision:1,voice:'voice1',voices:['voice1'],status:'TECHNICAL_VALID',units:Array.from({length:12},(_,i)=>({id:`u${i}`,text:'Đây là bản kể dài để kiểm tra việc đọc và phân trang. '.repeat(10),gap_after_ms:0,selected_take:'t1',takes:[take]})),assembly:take,timing:{words:Array.from({length:40},(_,i)=>({anchor_id:`w${i}`,text:'chữ',startMs:i*100,endMs:i*100+90})),duration_seconds:4}};
  window.layoutFixture = (method) => {
   if(method==='health') return {status:'READY'};
   if(method==='projects.list') return Array.from({length:20},(_,i)=>({...project,project_id:`p${i+1}`}));
   if(method==='projects.open'||method==='projects.get') return project;
   if(method.startsWith('events.')) return Array.from({length:30},(_,i)=>({event_seq:i,revision:i,kind:'project.note',payload:{text:'Ghi chú dài. '.repeat(60)}}));
   if(method==='assets.list') return {total:30,items:Array.from({length:30},(_,i)=>({id:`asset-${i}`,role:'prop',sha256:'a'.repeat(64)}))};
   if(method==='assets.gallery') return {format:'layout-fixture',source_revision:'a'.repeat(64),themes:[{id:'light',title:'Giấy sáng',canvas:'#fff9ef',ink:'#243540',caption:'#FFFDF9',caption_ink:'#15232D'}],items:Array.from({length:13},(_,i)=>({id:`asset-${i}`,role:'prop',contexts:['comedy'],source_sha256:'a'.repeat(64),preview_data_uri:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 100"><rect width="50" height="100" fill="purple"/></svg>')}))};
   if(method==='visual.open') return {revision:1,theme:'light',intent:{scenes},events:Array.from({length:30},(_,i)=>({event_seq:i,revision:i,kind:'scene.patch',payload:{}})),build:{id:'',revision:1,scenes:scenes.map(s=>({id:s.id,duration_seconds:4,start_ms:0,qa:{caption_contrast:7,status:'PASS',issues:[]}})),cache:{reused:10,rebuilt:2},resources:{wall_ms:2000,peak_rss_bytes:10000000},renderer_parity:'PENDING'},job:{message:'Build hoàn tất',status:'COMPLETED',ready_scenes:[],total:12}};
   if(method==='assets.find_candidates') return {usage_evidence:{coverage:{truncated:true}},bundles:Array.from({length:3},(_,i)=>({candidate_id:`c${i}`,asset_id:`phone-${i}`,identity:{model_id:'phone'},fit_reasons:['Đúng vai trò'],warnings:[],usage:[{project_id:'old',episode_id:'previous-episode',build_id:'a'.repeat(32),manifest_sha256:'b'.repeat(64),source_sha256:'c'.repeat(64),scene_ids:['s02'],review_status:'NOT_REVIEWED'}]})),rejected:[]};
   if(method==='voice.open') {
    if(!window.slowVoice) return voice;
    window.voiceReads=(window.voiceReads||0)+1;window.voicePending=(window.voicePending||0)+1;
    window.voicePeak=Math.max(window.voicePeak||0,window.voicePending);
    return new Promise(resolve=>setTimeout(()=>{window.voicePending--;resolve(voice);},4000));
   }
   if(method==='voice.audio') return {data:btoa('RIFFfixture'),total:11};
   if(method==='agent.health') return {available:true};
   if(method==='agent.tasks') return [{project_id:'p1',task_id:'t1',status:'COMPLETED',kind:'scene.propose',scene_id:'s1',write_applied:true,applied_command_id:'agent-'+'a'.repeat(32),suggestion:JSON.stringify({kind:'scene.patch',payload:{scene_id:'s1',entity_id:'actor',state_id:'normal',changes:{x:300}}}),project_revision:1}];
   return {};
  };
 });
 async function fit(label) {
  await page.waitForTimeout(180);
  const overflow = await page.evaluate(() => {
   const root=document.documentElement;
   const outside=[...document.querySelectorAll('button,input,select,textarea,.pagination,.visual-viewport')].filter(el=>{
    const r=el.getBoundingClientRect(); return r.width&&r.height&&(r.bottom>innerHeight+1||r.right>innerWidth+1||r.left< -1);
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
 await page.waitForSelector('.episode-item');
 for(const [width,height] of [[1366,768],[1060,650],[1093,614]]) {
  await page.setViewportSize({width,height});
  assert.equal(await page.locator('.sidebar-nav button').count(),3);
  for(const view of ['Tổng quan','Kho tài nguyên','Nhật ký','Agent','Giọng đọc','Hình ảnh']) {
   if(view==='Kho tài nguyên') await page.locator('.sidebar-nav').getByRole('button',{name:'Tài nguyên',exact:true}).click();
   else {
    if(!await page.locator('.workflow-tabs').getByRole('button',{name:view,exact:true}).count()) await page.locator('.sidebar-nav').getByRole('button',{name:'Episode',exact:true}).click();
    await page.locator('.workflow-tabs').getByRole('button',{name:view,exact:true}).click();
   }
   await fit(`${width}x${height} ${view}`);
   if(view==='Tổng quan') {
    await page.getByRole('button',{name:'Episode: trang sau',exact:true}).click();
    assert.match(await page.locator('.episode-list').innerText(),/p4/);
    await page.getByRole('button',{name:'Ghi chú & hoạt động',exact:true}).click(); await fit('notes');
    await page.getByRole('button',{name:'Episode & trạng thái',exact:true}).click();
   }
   if(view==='Giọng đọc') {
    for(const tab of ['Nghe toàn bài & timing','Thiết lập giọng','Từng đoạn']) {
     await page.getByRole('button',{name:tab,exact:true}).click(); await fit(`voice ${tab}`);
     if(tab==='Nghe toàn bài & timing') { await page.locator('.voice-timing summary').click(); await fit('timing pages'); }

    }
   }
   if(view==='Hình ảnh') {
    await page.locator('.episode-context').getByRole('button',{name:/Tiếp theo: Xuất/}).waitFor({timeout:5000});
    await page.getByRole('button',{name:'Cảnh: trang sau',exact:true}).click();
    await page.getByRole('button',{name:'Kho hình ảnh',exact:true}).click();
    await page.locator('.gallery-card').first().waitFor(); await fit('embedded gallery');
    await page.getByRole('button',{name:'Kho hình ảnh',exact:true}).click();
    for(const tab of ['Sự kiện','Hình ảnh','Agent','Đối tượng']) {
     await page.locator('.visual-inspector').getByRole('button',{name:tab,exact:true}).click(); await fit(`inspector ${tab}`);
     if(tab==='Sự kiện') {
      await page.getByRole('button',{name:'Chỉnh nhịp diễn theo lời kể',exact:true}).click(); await fit('acting editor');
      await page.getByRole('button',{name:'Sự kiện diễn xuất: trang sau',exact:true}).click(); await fit('acting event pages');
      await page.getByRole('button',{name:'Đóng',exact:true}).click();
     }
     if(tab==='Hình ảnh') { await page.getByRole('button',{name:'Tìm bundle phù hợp',exact:true}).click(); await fit('candidates'); assert.match(await page.locator('.visual-candidates').filter({visible:true}).innerText(),/phạm vi quét giới hạn/); }

    }
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
 await page.evaluate(()=>{window.slowVoice=true;});
 await page.locator('.workflow-tabs').getByRole('button',{name:'Giọng đọc',exact:true}).click();
 await page.waitForFunction(()=>window.voicePending===1);
 await page.waitForTimeout(3200);
 assert.equal(await page.evaluate(()=>window.voicePeak),1,'slow reads must not overlap');
 const selectedUnit=await page.locator('.voice-unit.active').innerText();
 await page.locator('.workflow-tabs').getByRole('button',{name:'Hình ảnh',exact:true}).click();
 const reads=await page.evaluate(()=>window.voiceReads);
 await page.waitForTimeout(3500);
 assert.equal(await page.evaluate(()=>window.voiceReads),reads,'hidden Voice Lab must stop polling');
 await page.evaluate(()=>{window.slowVoice=false;});
 await page.locator('.workflow-tabs').getByRole('button',{name:'Giọng đọc',exact:true}).click();
 assert.equal(await page.locator('.voice-unit.active').innerText(),selectedUnit,'sub-tab switch must retain selection');
 assert.deepEqual(failures,[]);
 console.log('PASS: six views, inspector/voice/source/log tabs, pagination, three viewport sizes; fixture-only backend.');
} finally { await browser.close(); }
