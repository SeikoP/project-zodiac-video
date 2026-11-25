import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {installWorkbenchFixture} from './studio_workbench_fixture.mjs';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({executablePath:process.env.STUDIO_BROWSER,headless:true});
try {
 const page=await browser.newPage({viewport:{width:1366,height:768}}); const errors=[];
 page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await installWorkbenchFixture(page);
 const calls=name=>page.evaluate(n=>(window.pipelineCalls||[]).filter(c=>c[0]===n),name);
 const poll=()=>page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 const selectStep=async id=>{
  const row=page.locator(`.step-row[data-node-id="${id}"]`);
  const phase=page.locator('.step-phase').filter({has:row});
  if(!await phase.evaluate(el=>el.open)) await phase.locator(':scope > summary').click();
  await row.locator('.step-main').click();
 };
 await page.goto(process.env.STUDIO_URL||'http://127.0.0.1:1420');
 await page.locator('.workflow-tabs').getByRole('button',{name:'Quy trình',exact:true}).click();
 await page.locator('.step-row:visible').first().waitFor({timeout:15000});
 assert.ok(await page.locator('.step-row').count()>=13,'graph shows 13+ nodes');
 assert.equal(await page.locator('.step-row[data-kind=gate] .step-run').count(),0,'gates have no run button');
 assert.equal(await page.locator('.production-manager').locator('.stage-row, .stat-card, .metric-card, .sidebar').count(),0,'no dashboard cards in Episode view');
 assert.equal(await page.locator('.next-action').count(),1);

 // autopilot + mode
 assert.equal(await page.getByRole('button',{name:/Chạy tự động/}).isDisabled(),true,'confirm mode cannot autopilot');
 await page.getByRole('switch').click();
 await page.waitForFunction(()=>window.pipelineMode==='autopilot');
 await page.getByRole('button',{name:/Chạy tự động/}).click();
 await page.getByText('Cần bạn duyệt: Nghe giọng').waitFor();
 assert.equal((await calls('pipeline.autopilot.start')).length,1);
 assert.deepEqual((await calls('pipeline.mode.set')).map(c=>c[1].mode),['autopilot']);

 // STALE node: one run with the current base_revision
 await page.evaluate(()=>{window.pipelineStatus={assets:'STALE'};}); await poll();
 await page.locator('.step-row[data-node-id=assets] small').filter({hasText:'Cần làm lại'}).waitFor();
 await page.locator('.step-row[data-node-id=assets] .step-run').click();
 await page.waitForFunction(()=>(window.pipelineCalls||[]).some(c=>c[0]==='pipeline.run'));
 assert.deepEqual((await calls('pipeline.run')).map(c=>c[1]),[{project_id:'p1',node_id:'assets',base_revision:1}]);
 await page.evaluate(()=>{window.pipelineStatus={};}); await poll();

 // keyboard reaches export
 await selectStep('content');

 // identical poll renders nothing

 // Voice and export each use their own full-width stage.
 await selectStep('voice');
 await page.getByRole('region',{name:'Danh sách đoạn đọc',exact:true}).waitFor();
 assert.equal(await page.locator('.visual-stage:visible').count(),0,'voice gets the full stage');
 await selectStep('export');
 await page.locator('.episode-export:visible').waitFor();

 // unknown node falls back to the generic panel
 await page.evaluate(()=>{window.unknownNode=true;}); await poll();
 await page.locator('.step-row[data-node-id=mystery]').waitFor();
 await selectStep('mystery'); await page.keyboard.press('Enter');
 await page.locator('.generic-inspector').getByRole('heading',{name:'mystery'}).waitFor();

 // user-only review gate: evidence, playback, confirm
 await selectStep('visual_review'); await page.keyboard.press('Enter');
 await page.getByRole('heading',{name:'Duyệt hình ảnh',exact:true}).waitFor();
 await page.getByText('Tiêu đề đăng').waitFor();
 assert.equal(await page.getByRole('button',{name:'Duyệt hình ảnh',exact:true}).isDisabled(),true,'cannot confirm before watching');
 await page.getByRole('button',{name:'Bắt đầu xem bản dựng',exact:true}).click();
 await page.getByRole('button',{name:'Duyệt hình ảnh',exact:true}).waitFor();
 await page.waitForFunction(()=>![...document.querySelectorAll('button')].find(b=>b.textContent==='Duyệt hình ảnh')?.disabled);
 await page.getByRole('button',{name:'Duyệt hình ảnh',exact:true}).click();
 await page.waitForFunction(()=>(window.pipelineCalls||[]).some(c=>c[0]==='pipeline.gate.confirm'));
 assert.deepEqual((await calls('pipeline.gate.confirm')).map(c=>c[1]),[{project_id:'p1',gate:'visual_review',base_revision:1,build_id:'b'.repeat(32),playback_id:'pb1'}]);

 // layout at four sizes
 for(const [width,height] of [[1366,768],[1060,650],[1093,614],[800,960]]) {
  await page.setViewportSize({width,height}); await page.waitForTimeout(300);
  const m=await page.evaluate(()=>({h:document.querySelector('.step-list').getBoundingClientRect().height,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,iw:innerWidth,ih:innerHeight}));
  assert.ok(m.h>=190,`graph canvas >=190px at ${width}x${height}: ${JSON.stringify(m)}`);
  assert.ok(m.sw<=m.iw,`no horizontal scroll at ${width}x${height}: ${JSON.stringify(m)}`);
  assert.ok(m.sh<=m.ih+1,`no page scroll at ${width}x${height}: ${JSON.stringify(m)}`);
 }
 assert.deepEqual(errors,[]);
 console.log('PASS pipeline graph, autopilot, gates, inspector registry, review confirm, four sizes');
} finally { await browser.close(); }
