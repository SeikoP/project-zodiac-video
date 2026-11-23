import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {realpath} from 'node:fs/promises';
import path from 'node:path';
import {renderPreview,previewRuntime,quality} from '../tools/studio_project/visual_preview.mjs';
import {resolveDisplayedEntityState} from '../runtime/zodiac-renderer/2.0.2/renderer/src/spatial-layout.mjs';
import {resolveSemanticMotion} from '../runtime/zodiac-renderer/2.0.2/renderer/src/semantic-motion.mjs';

async function play(scene,time){
 const runtime=await previewRuntime(path.resolve('.'));
 const assets={a:{svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M0 0H20V20H0Z"/></svg>',source_sha256:'a'.repeat(64)}};
 const preview=renderPreview(scene,assets,time,'light',runtime.gsap,runtime.font);
 const sdk=await realpath('apps/zodiac-studio/node_modules/@hyperframes/sdk/dist/index.js');
 const {document}=createRequire(sdk)('linkedom').parseHTML(preview.html);
 let at=0,update;const tl={time:()=>at,to:()=>tl,seek(t){at=t;update();return tl;},pause:()=>tl};
 vm.runInNewContext([...document.querySelectorAll('script')].at(-1).textContent,{document,window:{},parent:{postMessage(){}},addEventListener(){},gsap:{timeline(o){update=o.onUpdate;return tl;}}});
 return {document,html:preview.html,seek:t=>tl.seek(t)};
}
const states={before:{asset:'a',visible:true,layer:3,transform:{x:100,y:200,width:300,height:400,scale:1.25,rotation:8}},after:{asset:'a',visible:true,layer:3,transform:{x:300,y:200,width:300,height:400,scale:1.25,rotation:8}}};
test('migration preserves Remotion state at every frame and stepped semantic motion',async()=>{
 for(const motion of ['state_swap','small-bounce','subtle-tilt','focus-shift','fade-out','pop-in']){
  const event={event_id:'react',target:'actor',state_before:'before',state_after:'after',start_frame:6,end_frame:18,motion};
  const scene={id:'migration',start_frame:0,entities:[{id:'actor',kind:'character',initial_state:'before',states}],events:[event]};
  const played=await play(scene,{fps:30,startMs:0,endMs:1000,words:[],events:[{...event,at:.2,preview_duration:.4,preview_motion:motion}]});
  for(let frame=0;frame<30;frame++){
   played.seek(frame/30);
   const expected=resolveDisplayedEntityState(scene,scene.entities[0],frame),resolved=resolveSemanticMotion(frame>=6&&frame<18?event:null,scene,scene.entities[0],frame);
   const visible=[...played.document.querySelectorAll('[data-entity-id]')].filter(n=>n.style.visibility==='visible');
   assert.equal(visible.length,1,`${motion} frame ${frame}`);
   assert.equal(visible[0].dataset.stateId,expected===states.after?'after':frame>=18?'after':'before',`${motion} frame ${frame}`);
   assert.equal(visible[0].style.transform,`translate(${resolved.translateX}px, ${resolved.translateY}px) scale(${1.25*resolved.scale}) rotate(${8+resolved.rotateDeg}deg)`);
  }
 }
});
test('caption QA respects authored safe zone and detects actors beneath caption text',()=>{
 const scene={id:'layout',layout_contract:{caption_safe_zone:{x:80,y:1470,width:920,height:360}},entities:[{id:'actor',kind:'character',initial_state:'before',states:{before:{...states.before,transform:{x:200,y:1550,width:400,height:200}}}}]};
 assert.ok(quality(scene,'light').issues.some(i=>i.code==='CAPTION_OCCLUSION'));
 scene.entities[0].states.before.transform.y=400;
 assert.equal(quality(scene,'light').status,'PASS');
});
test('preview keeps canonical brand and outlined 84px captions without a replacement card',async()=>{
 const played=await play({id:'brand',entities:[{id:'actor',kind:'character',initial_state:'before',states}],events:[]},{fps:30,startMs:0,endMs:1000,words:[],events:[]});
 assert.ok(played.document.querySelector('[data-watermark="brand"]'));
 assert.match(played.html,/font-size:84px/u);
 assert.doesNotMatch(played.html,/top:740px|border-radius:24px/u);
 assert.match(played.html,/#F6F0E6/iu);
});
test('scaled/rotated artwork and motion peaks cannot pass caption/canvas QA using an untransformed box',()=>{
 const scene={id:'scaled',entities:[{id:'actor',kind:'character',initial_state:'a',states:{a:{asset:'a',transform:{x:200,y:1200,width:200,height:200,scale:3}}}}]};
 assert.ok(quality(scene,'light').issues.some(i=>i.code==='CAPTION_OCCLUSION'));
 scene.entities[0].states.a.transform={x:0,y:100,width:200,height:200,rotation:45};
 assert.ok(quality(scene,'light').issues.some(i=>i.code==='OUTSIDE_CANVAS'));
 scene.entities[0].states.a.transform={x:200,y:1260,width:200,height:200};
 const timing={fps:30,startMs:0,endMs:1000,events:[{id:'zoom',target:'actor',state_before:'a',state_after:'a',at:0,preview_duration:1,preview_motion:'focus-shift'}]};
 assert.equal(quality(scene,'light').status,'PASS');
 scene.entities[0].states.a.transform.y=1268;
 assert.ok(quality(scene,'light',timing).issues.some(i=>i.code==='CAPTION_OCCLUSION'));
});
