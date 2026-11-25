import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {realpath} from 'node:fs/promises';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {resolveActing,resolveCamera,validateActingEvent,validateCameraShots,ACTING} from '../tools/studio_project/visual_acting.mjs';
import {validateIntent} from '../tools/studio_project/visual_compiler.mjs';
import {renderPreview,previewRuntime} from '../tools/studio_project/visual_preview.mjs';
import {makeFixture} from './studio_p34_fixture.mjs';

const ev=(over)=>({id:'e1',target:'actor',motion:'lean',start_frame:10,end_frame:24,params:{degrees:-19,dx:-98},...over});

test('registry is Studio-only and bounded by the approved style spec',()=>{
  assert.equal(ACTING.format,'zodiac-studio-acting@1');
  assert.deepEqual(Object.keys(ACTING.motions).sort(),['lean','pull-with-prop','recoil']);
  assert.equal(ACTING.motions.lean.max_degrees,20);
  assert.equal(ACTING.camera.max_push_zoom,1.25);
  assert.equal(ACTING.camera.max_cut_zoom,2);
});

test('lean reaches exactly its end pose, steps on twos and holds until the next acting event',()=>{
  const events=[ev()];
  assert.deepEqual(resolveActing(events,'actor',9),{translateX:0,translateY:0,rotateDeg:0,active:false});
  assert.equal(resolveActing(events,'actor',23).rotateDeg,-19);
  assert.equal(resolveActing(events,'actor',23).translateX,-98);
  assert.equal(resolveActing(events,'actor',200).rotateDeg,-19,'hold settle persists');
  const a=resolveActing(events,'actor',14),b=resolveActing(events,'actor',15);
  assert.ok(a.rotateDeg!==0&&a.rotateDeg>-19);
  const grid=[12,13,14,15,16,17].map(f=>resolveActing(events,'actor',f).rotateDeg);
  assert.ok(new Set(grid).size<grid.length,'on-twos sampling repeats values');
  assert.equal(resolveActing([ev({params:{degrees:-19,dx:-98,settle:'return'}})],'actor',200).rotateDeg,0);
});

test('a later event returns the figure from the held pose',()=>{
  const events=[ev(),ev({id:'e2',start_frame:40,end_frame:48,params:{degrees:0,dx:0}})];
  assert.equal(resolveActing(events,'actor',39).rotateDeg,-19);
  assert.equal(resolveActing(events,'actor',48).rotateDeg,0);
});

test('pull-with-prop moves actor and held prop by the identical translation, group has no rotation',()=>{
  const events=[ev({motion:'pull-with-prop',target:'cap',params:{dx:-70,dy:0,group:['bag']}})];
  for(const f of [12,16,20,23,40]){
    const cap=resolveActing(events,'cap',f),bag=resolveActing(events,'bag',f);
    assert.equal(bag.translateX,cap.translateX);assert.equal(bag.translateY,cap.translateY);assert.equal(bag.rotateDeg,0);
  }
  assert.equal(resolveActing(events,'other',23).translateX,0);
});

test('camera: from-framing is a hard cut, push interpolates, ends exactly on target and holds',()=>{
  const shots=[{start_frame:0,end_frame:0,from:{x:540,y:960,zoom:1},to:{x:540,y:960,zoom:1}},
    {start_frame:48,end_frame:72,from:{x:858,y:640,zoom:1.9},to:{x:858,y:630,zoom:2}}];
  assert.deepEqual(resolveCamera([],5),{x:540,y:960,zoom:1});
  assert.equal(resolveCamera(shots,47).zoom,1);
  assert.equal(resolveCamera(shots,48).zoom,1.9,'cut lands on the authored from framing');
  const mid=resolveCamera(shots,60).zoom;assert.ok(mid>1.9&&mid<2);
  assert.equal(resolveCamera(shots,71).zoom,2);assert.equal(resolveCamera(shots,500).zoom,2);
});

test('validation rejects out-of-style acting parameters',()=>{
  const scene={entities:[{id:'actor'},{id:'bag'}]};
  assert.throws(()=>validateActingEvent({motion:{preset:'lean',params:{degrees:45}}},scene,'actor'),/VISUAL_ACTING_PARAM_INVALID/);
  assert.throws(()=>validateActingEvent({motion:{preset:'lean',params:{degrees:5,dx:900}}},scene,'actor'),/VISUAL_ACTING_PARAM_INVALID/);
  assert.throws(()=>validateActingEvent({motion:{preset:'pull-with-prop',params:{dx:-70}}},scene,'actor'),/VISUAL_ACTING_GROUP_REQUIRED/);
  assert.throws(()=>validateActingEvent({motion:{preset:'pull-with-prop',params:{dx:-70,group:['ghost']}}},scene,'actor'),/VISUAL_ACTING_GROUP_UNKNOWN/);
  assert.doesNotThrow(()=>validateActingEvent({motion:{preset:'pull-with-prop',params:{dx:-70,group:['bag']}}},scene,'actor'));
  assert.doesNotThrow(()=>validateActingEvent({motion:{preset:'recoil',params:{degrees:-8,dx:-22}}},scene,'actor'));
});

test('camera validation: bounds, push cap, cut cap with a stated reason',()=>{
  const shot=(from,to,extra={})=>({id:'c1',trigger:{type:'scene_start'},from,to,duration_frames:12,...extra});
  assert.throws(()=>validateCameraShots([shot(undefined,{x:540,y:960,zoom:1.5})]),/VISUAL_CAMERA_PUSH_TOO_CLOSE/);
  assert.throws(()=>validateCameraShots([shot({x:100,y:960,zoom:2},{x:100,y:960,zoom:2},{reason:'close on the reaction'})]),/VISUAL_CAMERA_OUT_OF_CANVAS/);
  assert.throws(()=>validateCameraShots([shot({x:540,y:960,zoom:1.8},{x:540,y:960,zoom:1.8})]),/VISUAL_CAMERA_REASON_REQUIRED/);
  assert.throws(()=>validateCameraShots([shot({x:540,y:960,zoom:2.4},{x:540,y:960,zoom:2.4},{reason:'close on the reaction'})]),/VISUAL_CAMERA_CUT_TOO_CLOSE/);
  assert.doesNotThrow(()=>validateCameraShots([shot({x:760,y:640,zoom:1.9},{x:760,y:630,zoom:2},{reason:'close on the phone ping'})]));
  assert.doesNotThrow(()=>validateCameraShots([shot(undefined,{x:540,y:900,zoom:1.12})]));
});

test('validateIntent accepts acting and camera and rejects bad ones',()=>{
  const narration='Song Tử hỏi thêm câu một. Song Tử hỏi thêm câu hai.';
  const good=makeFixture(narration,1);
  good.scenes[0].events.unshift({id:'lean',target:'gemini',state_before:'neutral',state_after:'neutral',trigger:{type:'scene_start'},motion:{preset:'lean',duration_frames:14,params:{degrees:-12,dx:-40}}});
  good.scenes[0].camera=[{id:'push',trigger:{type:'scene_start'},to:{x:540,y:900,zoom:1.1},duration_frames:36}];
  assert.doesNotThrow(()=>validateIntent(good,narration));
  const bad=structuredClone(good);bad.scenes[0].events[0].motion.params.degrees=60;
  assert.throws(()=>validateIntent(bad,narration),/VISUAL_ACTING_PARAM_INVALID/);
  const bad2=structuredClone(good);bad2.scenes[0].camera[0].to.zoom=1.9;
  assert.throws(()=>validateIntent(bad2,narration),/VISUAL_CAMERA_PUSH_TOO_CLOSE/);
});

async function runPreview(html){
  const sdk=await realpath(path.resolve('apps/zodiac-studio/node_modules/@hyperframes/sdk/dist/index.js'));
  const {parseHTML}=createRequire(sdk)('linkedom'),{document}=parseHTML(html),window={};let at=0,update;
  const timeline={time:()=>at,to:()=>timeline,seek(t){at=t;update();return timeline;},pause:()=>timeline};
  const context={document,window,parent:{postMessage(){}},addEventListener(){},gsap:{timeline(options){update=options.onUpdate;return timeline;}}};
  vm.runInNewContext([...document.querySelectorAll('script')].at(-1).textContent,context);
  return {document,seek:seconds=>timeline.seek(seconds)};
}

test('shared painter applies lean about the feet and the camera to every entity; captions untouched',async()=>{
  const runtime=await previewRuntime(path.resolve('.'));
  const scene={id:'s01',entities:[{id:'actor',initial_state:'idle',states:{idle:{asset:'a',transform:{x:200,y:300,width:300,height:400}}}},
    {id:'bag',initial_state:'idle',states:{idle:{asset:'a',transform:{x:520,y:500,width:100,height:150}}}}]};
  const assets={a:{svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M0 0H20V20Z"/></svg>',source_sha256:'a'.repeat(64)}};
  const time={scene_id:'s01',fps:30,startMs:0,endMs:3000,measured:true,words:[{text:'Xin',startMs:0,endMs:400}],
    events:[{id:'lean',target:'actor',state_before:'idle',state_after:'idle',at:.5,preview_motion:'lean',preview_duration:.5,preview_params:{degrees:-19,dx:-98}},
            {id:'pull',target:'actor',state_before:'idle',state_after:'idle',at:1.5,preview_motion:'pull-with-prop',preview_duration:.3,preview_params:{dx:-70,group:['bag']}}],
    camera:[{at:2,duration:.5,from:{x:540,y:960,zoom:1},to:{x:540,y:900,zoom:1.2}}]};
  const out=renderPreview(scene,assets,time,'indigo-noir',runtime.gsap,runtime.font);
  assert.deepEqual(out.unsupported_motions,[]);
  assert.equal(out.fidelity,'SOURCE_ASSETS_MEASURED_STATE_TIMING');
  const {document,seek}=await runPreview(out.html);
  const node=id=>[...document.querySelectorAll('[data-entity-id]')].find(n=>n.dataset.entityId===id);
  seek(0.2);assert.ok(!node('actor').style.transform.includes('rotate(-'),'idle before the lean');
  seek(1.2);assert.ok(node('actor').style.transform.includes('rotate(-19deg)'));
  assert.equal(node('actor').style.transformOrigin,'50% 100%');
  seek(1.9);
  assert.ok(node('actor').style.transform.includes('translate(-168px'),'lean dx plus pull dx');
  assert.ok(node('bag').style.transform.includes('translate(-70px'),'prop follows the pull');
  seek(0);const left0=parseFloat(node('actor').style.left),w0=parseFloat(node('actor').style.width);
  seek(2.6);assert.ok(parseFloat(node('actor').style.width)>w0*1.19,'camera zoom scales width');
  assert.notEqual(parseFloat(node('actor').style.left),left0);
});

test('pull-with-prop is relative to each member\'s held pose and keeps the actor lean',()=>{
  const events=[ev(),ev({id:'p',motion:'pull-with-prop',start_frame:30,end_frame:38,params:{dx:-70,group:['bag']}})];
  assert.equal(resolveActing(events,'actor',60).translateX,-168);
  assert.equal(resolveActing(events,'actor',60).rotateDeg,-19);
  assert.equal(resolveActing(events,'bag',60).translateX,-70);
});
