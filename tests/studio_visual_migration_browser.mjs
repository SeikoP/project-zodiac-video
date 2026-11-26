// Real pinned React/Remotion stills vs HyperFrames preview AND export, same source/assets.
// No media approvals, source rewrites, TTS or production release.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {renderPreview,renderEpisode,previewRuntime} from '../tools/studio_project/visual_preview.mjs';
import {measurePlanLayout} from '../runtime/zodiac-renderer/2.0.2/renderer/scripts/measure-layout.mjs';
import {resolveDisplayedEntityState} from '../runtime/zodiac-renderer/2.0.2/renderer/src/spatial-layout.mjs';
import {resolveLayerOrder} from '../runtime/zodiac-renderer/2.0.2/renderer/src/visual-role.mjs';
import {digest} from '../tools/studio_project/visual_candidates.mjs';

const out=path.resolve(process.env.VISUAL_MIGRATION_OUTPUT??'.runtime/visual-migration');await mkdir(out,{recursive:true});
const root=path.resolve('runtime/zodiac-renderer/2.0.2/renderer'),fixture=path.join(root,'tests/fixtures/songtu');
const source=JSON.parse(await readFile(path.join(fixture,'render-plan.json'),'utf8'));
const runtime=await previewRuntime(path.resolve('.')),assets={};
for(const [id,a]of Object.entries(source.assets)){
 const bytes=await readFile(path.join(fixture,a.path));
 assets[id]={...a,svg:bytes.toString('utf8'),source_sha256:digest(bytes)};
 source.assets[id]={...a,src:'data:image/svg+xml;base64,'+bytes.toString('base64')};
}
source.presentation.caption.font_data_uri='data:font/ttf;base64,'+runtime.font.base64;
const measured=await measurePlanLayout(source);
const text='Nhân Mã nói thật lòng, nhưng hội bạn cứ tưởng đang trêu. Câu chuyện đổi hướng khi cả nhóm nhìn lại lời nhắn và nhận ra người kia đã trả lời rất rõ từ đầu.';
const tokens=text.split(/\s+/u),unit=180/tokens.length;
const dynamic=structuredClone(measured.scenes[0]);dynamic.id='measured-vietnamese';dynamic.start_frame=0;dynamic.duration_frames=180;dynamic.events=[];
const speech=tokens.map((text,i)=>({text,startMs:i*unit/measured.fps*1000,endMs:(i+1)*unit/measured.fps*1000}));
dynamic.captions=[{text,start_frame:0,end_frame:180,words:tokens.map((text,i)=>({text:text.replace(/[^\p{L}\p{N}_]/gu,''),start_frame:i*unit,end_frame:(i+1)*unit}))}];
const measuredDynamic=await measurePlanLayout({...measured,scenes:[dynamic]});
const require=createRequire(path.join(root,'package.json')),cli=createRequire(require.resolve('@remotion/cli/package.json'));
const {bundle}=cli('@remotion/bundler'),{renderStill,selectComposition,openBrowser}=cli('@remotion/renderer');
const serveUrl=await bundle({entryPoint:path.join(root,'src/index.ts'),outDir:path.join(out,'remotion-bundle'),onProgress(){}});
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({executablePath:process.env.STUDIO_BROWSER,headless:true});
const remotionBrowser=await openBrowser('chrome',{browserExecutable:process.env.STUDIO_BROWSER,logLevel:'error'});
const results=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.message);});
 const selected=await selectComposition({serveUrl,id:'ZodiacRenderPlan',inputProps:{...measured,publish:undefined},puppeteerInstance:remotionBrowser});
 // Includes native two-actor composition, foreground occlusion, prop contacts, every
 // motion family present in the historical fixture, and before/peak/after swaps.
 for(const original of [...measured.scenes,...measuredDynamic.scenes]){
  const offset=original.start_frame,scene=structuredClone(original);scene.start_frame=0;
  scene.events=scene.events.map(e=>({...e,start_frame:e.start_frame-offset,end_frame:e.end_frame-offset}));
  scene.captions=scene.captions.map(c=>({...c,start_frame:c.start_frame-offset,end_frame:c.end_frame-offset,words:c.words?.map(w=>({...w,start_frame:w.start_frame-offset,end_frame:w.end_frame-offset}))}));
  const time={fps:measured.fps,startMs:0,endMs:scene.duration_frames/measured.fps*1000,words:[],measured:true,events:scene.events.map(e=>({...e,id:e.event_id,at:e.start_frame/measured.fps,preview_duration:(e.end_frame-e.start_frame)/measured.fps,preview_motion:e.motion}))};
  const candidate=structuredClone(scene);
  if(scene.id==='measured-vietnamese'){delete candidate.captions;time.words=speech;}
  const single=renderPreview(candidate,assets,time,'light',runtime.gsap,runtime.font,measured.presentation);
  const full=renderEpisode([{scene:candidate,time}],assets,'light',measured.fps,runtime,measured.presentation);
  const frames=[...new Set([0,...(scene.id==='measured-vietnamese'?[12,48,90,150,179]:[]),...scene.events.flatMap(e=>[Math.max(0,e.start_frame-1),e.start_frame+Math.floor((e.end_frame-e.start_frame-1)/2),Math.min(scene.duration_frames-1,e.end_frame)])])];
  const props={...measured,scenes:[scene],publish:undefined};
  for(const frame of frames){
   const prefix=scene.id+'-f'+frame,remotion=prefix+'-remotion.png';
   await renderStill({serveUrl,composition:{...selected,props,durationInFrames:scene.duration_frames},inputProps:props,frame,output:path.join(out,remotion),puppeteerInstance:remotionBrowser,logLevel:'error'});
   console.log(prefix+': Remotion ready');
   for(const [kind,html]of [['preview',single.html],['export',full.html]]){
    console.log(prefix+' '+kind+': loading HTML');
    await page.goto('about:blank');await page.setContent(html);await page.waitForFunction(()=>Object.keys(window.__timelines??{}).length>0,{},{timeout:15000});
    console.log(prefix+' '+kind+': timeline ready');
    await page.evaluate(t=>{Object.values(window.__timelines)[0].seek(t,false).pause();},frame/measured.fps);
    console.log(prefix+' '+kind+': seek ready');
    await page.locator('img').evaluateAll(async nodes=>Promise.all(nodes.map(n=>n.decode())));
    await page.mouse.move(1079,1919);
    const states=Object.fromEntries(scene.entities.map(e=>[e.id,resolveDisplayedEntityState(scene,e,frame)]));
    const order=resolveLayerOrder(scene,measured.assets,states).map(e=>e.id);
    const actual=await page.locator('[data-entity-id]').evaluateAll(nodes=>nodes.filter(n=>n.style.visibility==='visible').sort((a,b)=>Number(a.style.zIndex)-Number(b.style.zIndex)).map(n=>({id:n.dataset.entityId,state:n.dataset.stateId,transform:n.style.transform})));
    assert.deepEqual(actual.map(n=>n.id),order.filter(id=>states[id]?.visible!==false));
    const caption=await page.locator(kind==='preview'?'#caption':'.episode-caption').evaluate(n=>({text:n.textContent,x:parseFloat(n.style.left),y:parseFloat(n.style.top)}));
    const cue=scene.captions.find(c=>frame>=c.start_frame&&frame<c.end_frame);
    assert.equal(caption.text,cue?.resolved_layout.lines.join('\n')??'');
    if(cue){assert.equal(caption.x,cue.resolved_layout.x);assert.equal(caption.y,cue.resolved_layout.y);}
    const file=prefix+'-'+kind+'.png';await page.screenshot({path:path.join(out,file)});
    results.push({scene_id:scene.id,frame,kind,remotion,candidate:file,states:actual,caption});
   }
  }
  console.log(scene.id+': '+frames.length+' matched state/layout samples');
 }
 assert.deepEqual(errors,[]);
 await writeFile(path.join(out,'samples.json'),JSON.stringify({format:'zodiac-renderer-parity-samples@1',fixture:'pinned-songtu-native-v4',source_sha256:digest(await readFile(path.join(fixture,'render-plan.json'))),results,errors,human_approval:'PENDING'},null,2));
 console.log('PASS '+results.length+' browser comparisons; pixel comparison follows.');
}finally{await browser.close();await remotionBrowser.close({silent:true});}
