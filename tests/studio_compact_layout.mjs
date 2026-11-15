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
 await page.route('**/src/backend.ts', async route => {
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
   if(method==='visual.open') return {revision:1,theme:'light',intent:{scenes},events:Array.from({length:30},(_,i)=>({event_seq:i,revision:i,kind:'scene.patch',payload:{}})),build:{id:'',revision:1,scenes:scenes.map(s=>({id:s.id,duration_seconds:4,start_ms:0,qa:{caption_contrast:7,status:'PASS',issues:[]}})),cache:{reused:10,rebuilt:2},resources:{wall_ms:2000,peak_rss_bytes:10000000},renderer_parity:'PENDING'},job:{message:'Build hoàn tất',status:'COMPLETED',ready_scenes:[],total:12}};
   if(method==='assets.find_candidates') return {bundles:Array.from({length:3},(_,i)=>({candidate_id:`c${i}`,asset_id:`phone-${i}`,identity:{model_id:'phone'},fit_reasons:['Đúng vai trò'],warnings:[]})),rejected:[]};
   if(method==='voice.open') return voice;
   if(method==='voice.audio') return {data:btoa('RIFFfixture'),total:11};
   if(method==='agent.health') return {available:true};
   if(method==='agent.tasks') return [{project_id:'p1',task_id:'t1',status:'COMPLETED',preview:'Agent kiểm tra. '.repeat(200),project_revision:1}];
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
  assert.deepEqual(overflow,{width:false,height:false,outside:[]},label);
 }
 await page.goto(process.env.STUDIO_URL || 'http://127.0.0.1:1420');
 await page.waitForSelector('.episode-item');
 for(const [width,height] of [[1366,768],[1060,650],[1093,614]]) {
  await page.setViewportSize({width,height});
  for(const view of ['Tổng quan','Kho tài nguyên','Nhật ký hoạt động','Agent','Voice Lab','Visual Workspace']) {
   await page.locator('.sidebar-nav').getByRole('button',{name:view,exact:true}).click();
   await fit(`${width}x${height} ${view}`);
   if(view==='Tổng quan') {
    await page.getByRole('button',{name:'Episode: trang sau',exact:true}).click();
    assert.match(await page.locator('.episode-list').innerText(),/p4/);
    await page.getByRole('button',{name:'Ghi chú & hoạt động',exact:true}).click(); await fit('notes');
    await page.getByRole('button',{name:'Episode & trạng thái',exact:true}).click();
   }
   if(view==='Voice Lab') {
    for(const tab of ['Nghe toàn bài & timing','Thiết lập giọng','Từng đoạn']) {
     await page.getByRole('button',{name:tab,exact:true}).click(); await fit(`voice ${tab}`);
     if(tab==='Nghe toàn bài & timing') { await page.locator('.voice-timing summary').click(); await fit('timing pages'); }

    }
   }
   if(view==='Visual Workspace') {
    await page.getByRole('button',{name:'Cảnh: trang sau',exact:true}).click();
    for(const tab of ['Sự kiện','Hình ảnh','Agent','Đối tượng']) {
     await page.locator('.visual-inspector').getByRole('button',{name:tab,exact:true}).click(); await fit(`inspector ${tab}`);
     if(tab==='Hình ảnh') { await page.getByRole('button',{name:'Tìm bundle phù hợp',exact:true}).click(); await fit('candidates'); }

    }
    await page.getByRole('button',{name:'Nguồn Visual Intent',exact:true}).click(); await fit('source');
    await page.getByRole('button',{name:'Đọc nguồn hiện tại',exact:true}).click();
    const textBefore = await page.getByRole('textbox',{name:'Canonical Visual Intent',exact:true}).inputValue();
    assert.ok(textBefore.length > 100);
    await page.getByRole('button',{name:'Canonical Visual Intent: trang sau',exact:true}).click();
    assert.notEqual(await page.getByRole('textbox',{name:'Canonical Visual Intent',exact:true}).inputValue(),textBefore);
    await fit('source pages');
    assert.equal(await page.getByRole('textbox',{name:'Canonical Visual Intent',exact:true}).evaluate(el=>el.scrollHeight>el.clientHeight),false,'source page must not scroll');
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
 assert.deepEqual(failures,[]);
 console.log('PASS: six views, inspector/voice/source/log tabs, pagination, three viewport sizes; fixture-only backend.');
} finally { await browser.close(); }
