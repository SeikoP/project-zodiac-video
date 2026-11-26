import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {installWorkbenchFixture} from './studio_workbench_fixture.mjs';

const {chromium} = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({executablePath:process.env.STUDIO_BROWSER,headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const output = process.env.STUDIO_REVIEW_OUTPUT || 'tmp/studio-visual-review';
await mkdir(output,{recursive:true});
try {
  const page = await browser.newPage({viewport:{width:1366,height:768}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await installWorkbenchFixture(page);
  await page.addInitScript(()=>{
    window.reviewBuild='b'.repeat(32);
    const fixture=window.layoutFixture;
    window.layoutFixture=(method,p)=>{
      const value=fixture(method,p);
      if(method==='pipeline.get'||method==='pipeline.evidence') value.build_id=window.reviewBuild;
      if(method==='visual.open') {value.build.id=window.reviewBuild;value.stale_preview=false;}
      if(method==='voice.open' && window.reviewWrongVoice) return {...value,assembly:{...value.assembly,wav_sha256:'changed'}};
      if(method==='visual.episode_preview') {
        if(window.failReviewPreview) throw Error('Review preview unavailable');
        return {build_id:p.build_id,duration_ms:48000,stale:false,html:'<!doctype html><html><body style="margin:0;background:#eee3ce"><h1>Whole episode fixture</h1><script>window.__timelines={episode:{pause(){},seek(t){document.body.dataset.time=t}}};</script></body></html>'};
      }
      return value;
    };
  });
  await page.goto(process.env.STUDIO_URL||'http://127.0.0.1:1420');
  const gate=page.locator('.step-row[data-node-id="visual_review"]');
  await gate.waitFor();
  const details=page.locator('.step-phase[data-phase=visual] > .phase-detail');
  assert.equal(await gate.locator('xpath=ancestor::details[contains(@class,"phase-detail")]').count(),0,'review stays outside technical details');
  assert.equal(await details.evaluate(el=>el.open),false);
  assert.equal(await page.locator('.hf-head:visible,.visual-receipt:visible,.log-toggle:visible').count(),0,'technical metadata is hidden by default');
  await page.getByRole('button',{name:'Chi tiết kỹ thuật',exact:true}).click();
  await page.getByRole('button',{name:'Nguồn Visual Intent',exact:true}).waitFor();
  await page.getByRole('button',{name:'Chi tiết kỹ thuật',exact:true}).click();
  await page.getByRole('button',{name:'Xem cả video',exact:true}).click();
  await page.locator('.whole-video .episode-player[data-ready=true]').waitFor();
  await page.locator('.whole-video').getByRole('button',{name:'Phát cả video',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.whole-video audio')?.paused===false);
  await page.locator('.whole-video audio').evaluate(el=>{window.oldEditorAudio=el;});
  await gate.locator('button').click();
  const review=page.locator('.stage-panel .review-inspector');
  await review.waitFor();
  assert.equal(await page.locator('.production-editor .episode-player').count(),0,'whole-video editor player is removed while reviewing');
  assert.equal(await page.evaluate(()=>window.oldEditorAudio.paused),true,'hidden editor audio is paused after unmount');
  assert.equal(await page.locator('.visual-toolbar:visible').count(),0,'editing controls do not distract from review');
  const calls=()=>page.evaluate(()=>window.pipelineCalls||[]);
  assert.equal((await calls()).filter(c=>c[0]==='pipeline.gate.playback').length,0,'opening review is not playback');
  const confirm=review.getByRole('button',{name:'Duyệt hình ảnh',exact:true});
  assert.equal(await confirm.isDisabled(),true);
  await review.getByRole('button',{name:'Bắt đầu xem bản dựng',exact:true}).click();
  await review.locator('.episode-player[data-ready=true]').waitFor();
  await page.waitForFunction(()=>(window.pipelineCalls||[]).some(c=>c[0]==='pipeline.gate.playback'));
  assert.equal(await confirm.isDisabled(),true,'ten seconds of viewing are still required');
  await page.waitForFunction(()=>![...document.querySelectorAll('.review-inspector button')].find(b=>b.textContent==='Duyệt hình ảnh')?.disabled,{},{timeout:15000});
  await confirm.click();
  await page.waitForFunction(()=>(window.pipelineCalls||[]).some(c=>c[0]==='pipeline.gate.confirm'));
  assert.equal((await calls()).filter(c=>c[0]==='pipeline.gate.confirm').length,1,'only explicit confirmation grants review');
  await page.evaluate(()=>{window.reviewBuild='c'.repeat(32);document.dispatchEvent(new Event('visibilitychange'));});
  await review.getByRole('button',{name:'Bắt đầu xem bản dựng',exact:true}).waitFor();
  assert.equal(await confirm.isDisabled(),true,'replacement build discards the old review');
  for(const [width,height] of [[1366,768],[1060,650],[1093,614],[800,960]]) {
    await page.setViewportSize({width,height});
    await review.getByRole('button',{name:'Bắt đầu xem bản dựng',exact:true}).click();
    await review.locator('.episode-player[data-ready=true]').waitFor();
    await page.waitForTimeout(350);
    const layout=await page.evaluate(()=>{
      const button=[...document.querySelectorAll('.review-inspector button')].find(b=>b.textContent==='Duyệt hình ảnh');
      const player=document.querySelector('.review-inspector .episode-player-stage');
      const transport=document.querySelector('.review-inspector .visual-transport');
      return {sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,iw:innerWidth,ih:innerHeight,button:button.getBoundingClientRect().toJSON(),player:player.getBoundingClientRect().toJSON(),transport:transport.getBoundingClientRect().toJSON()};
    });
    assert.ok(layout.sw<=width && layout.sh<=height+1,`no page scroll: ${JSON.stringify(layout)}`);
    assert.ok(layout.button.bottom<=height && layout.player.bottom<=height,`player and approval fit: ${JSON.stringify(layout)}`);
    assert.ok(layout.transport.height>20 && layout.transport.bottom<=height,`playback controls are visible and fit: ${JSON.stringify(layout)}`);
    await page.screenshot({path:`${output}/review-${width}x${height}.png`});
    await page.evaluate(()=>{window.reviewBuild=crypto.randomUUID().replaceAll('-','');document.dispatchEvent(new Event('visibilitychange'));});
    await review.getByRole('button',{name:'Bắt đầu xem bản dựng',exact:true}).waitFor();
  }
  await page.evaluate(()=>{window.reviewWrongVoice=true;});
  const beforeAudio=(await calls()).filter(c=>c[0]==='pipeline.gate.playback').length;
  await review.getByRole('button',{name:'Bắt đầu xem bản dựng',exact:true}).click();
  await review.getByRole('alert').filter({hasText:'Giọng đọc đã thay đổi'}).waitFor();
  assert.equal(await confirm.isDisabled(),true);
  assert.equal((await calls()).filter(c=>c[0]==='pipeline.gate.playback').length,beforeAudio,'mismatched voice cannot start review');
  await page.evaluate(()=>{window.reviewWrongVoice=false;window.failReviewPreview=true;});
  const issued=(await calls()).filter(c=>c[0]==='pipeline.gate.playback').length;
  await review.getByRole('button',{name:'Bắt đầu xem bản dựng',exact:true}).click();
  await review.getByRole('alert').filter({hasText:'Review preview unavailable'}).waitFor();
  assert.equal(await confirm.isDisabled(),true);
  assert.equal((await calls()).filter(c=>c[0]==='pipeline.gate.playback').length,issued,'failed preview cannot issue a playback');
  await page.evaluate(()=>{window.pipelineStatus={visual_review:'PENDING',inspect:'PENDING'};document.dispatchEvent(new Event('visibilitychange'));});
  await review.getByRole('status').filter({hasText:'Cần hoàn tất: Kiểm khung hình'}).waitFor();
  assert.equal(await review.getByRole('button',{name:'Bắt đầu xem bản dựng',exact:true}).count(),0,'blocked gate names its prerequisite instead of starting playback');
  assert.deepEqual(errors,[]);
  console.log('PASS visible review, actual playback, guarded confirmation, build reset, failed preview, four sizes');
} finally { await browser.close(); }
