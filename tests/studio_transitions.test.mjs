// Scene transitions (cut / paper-slide / page-turn) and the `enter` motion (components fly in from outside the screen).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {realpath} from 'node:fs/promises';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {TRANSITIONS,DEFAULT_TRANSITION,validateTransition,resolveTransition,paintTransition,resetTransition} from '../tools/studio_project/visual_transitions.mjs';
import {resolveActing,validateActingEvent,ACTING} from '../tools/studio_project/visual_acting.mjs';
import {validateIntent} from '../tools/studio_project/visual_compiler.mjs';
import {renderEpisode,previewRuntime} from '../tools/studio_project/visual_preview.mjs';
import {makeFixture} from './studio_p34_fixture.mjs';

const node=()=>({style:{}});

test('registry is Studio-only with bounded frame ranges',()=>{
  assert.equal(TRANSITIONS.format,'zodiac-studio-transitions@1');
  assert.deepEqual(Object.keys(TRANSITIONS.presets).sort(),['cut','page-turn','paper-slide']);
  assert.deepEqual(DEFAULT_TRANSITION,{preset:'page-turn',frames:12});
});

test('resolveTransition: nothing for cut or the last scene, clamped to 40% of the shorter neighbour',()=>{
  assert.equal(resolveTransition({preset:'cut',frames:0},90,90),null);
  assert.equal(resolveTransition(DEFAULT_TRANSITION,90,null),null); // last scene has no next
  assert.deepEqual(resolveTransition({preset:'page-turn',frames:12},90,90),{preset:'page-turn',frames:12,before:6,after:6});
  const short=resolveTransition({preset:'page-turn',frames:24},20,90);
  assert.equal(short.frames,8);                  // 40% of 20
  assert.equal(short.before+short.after,8);
  assert.equal(resolveTransition({preset:'page-turn',frames:12},2,90),null); // too short to carry a transition
  assert.equal(resolveTransition(undefined,90,90).preset,'page-turn');       // default when absent
});

test('validateTransition rejects unknown presets and out-of-range frames',()=>{
  assert.doesNotThrow(()=>validateTransition({preset:'paper-slide',frames:9}));
  assert.throws(()=>validateTransition({preset:'wipe',frames:9}),/VISUAL_TRANSITION_INVALID/);
  assert.throws(()=>validateTransition({preset:'page-turn',frames:3}),/VISUAL_TRANSITION_INVALID/);
  assert.throws(()=>validateTransition({preset:'page-turn',frames:60}),/VISUAL_TRANSITION_INVALID/);
  assert.throws(()=>validateTransition({preset:'page-turn',frames:12.5}),/VISUAL_TRANSITION_INVALID/);
});

test('paintTransition: progress 0 shows the outgoing scene untouched, progress 1 shows the incoming scene alone',()=>{
  for(const preset of ['page-turn','paper-slide']){
    const out=node(),inc=node();
    paintTransition(out,inc,preset,0,'#fff');
    assert.ok(!/rotateY\(-?[1-9]|translateX\(-[1-9]/.test(out.style.transform??''),preset+' outgoing at 0: '+out.style.transform);
    paintTransition(out,inc,preset,1,'#fff');
    assert.equal(out.style.visibility==='hidden'||out.style.opacity==='0',true,preset+' outgoing gone at 1');
  }
});

test('paintTransition is a pure function of progress and resetTransition clears every style it set',()=>{
  const a=node(),b=node(),c=node(),d=node();
  paintTransition(a,b,'page-turn',.4,'#fff');paintTransition(c,d,'page-turn',.4,'#fff');
  assert.deepEqual([a.style,b.style],[c.style,d.style]);
  resetTransition(a);resetTransition(b);
  for(const key of ['transform','transformOrigin','boxShadow','filter','background','visibility','zIndex'])assert.ok(!a.style[key]&&!b.style[key],key+' left behind');
});

test('validateIntent accepts a transition per scene and names the scene when it is invalid',()=>{
  const narration='Song Tử hỏi thêm câu một. Song Tử hỏi thêm câu hai.';
  const good=makeFixture(narration,2);
  good.scenes[0].transition={preset:'paper-slide',frames:9};
  assert.doesNotThrow(()=>validateIntent(good,narration));
  const bad=structuredClone(good);bad.scenes[0].transition={preset:'spin',frames:9};
  assert.throws(()=>validateIntent(bad,narration),/VISUAL_TRANSITION_INVALID.*\[scene /);
});

// ---- whole-episode composition ---------------------------------------------------------------------------------
async function play(html){
  const sdk=await realpath(path.resolve('apps/zodiac-studio/node_modules/@hyperframes/sdk/dist/index.js'));
  const {document}=createRequire(sdk)('linkedom').parseHTML(html);let at=0,update;
  const timeline={time:()=>at,to:()=>timeline,seek(t){at=t;update();return timeline;},pause:()=>timeline};
  vm.runInNewContext([...document.querySelectorAll('script')].at(-1).textContent,{document,window:{},parent:{postMessage(){}},addEventListener(){},gsap:{timeline(options){update=options.onUpdate;return timeline;}}});
  return {document,seek:t=>timeline.seek(t)};
}
const scene=id=>({id,entities:[{id:'actor',initial_state:'idle',states:{idle:{asset:'a',transform:{x:200,y:300,width:300,height:400}}}}],events:[]});
const assets={a:{svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M0 0H20V20Z"/></svg>',source_sha256:'a'.repeat(64)}};
const timing=(s,e)=>({fps:30,startMs:s,endMs:e,measured:true,words:[{text:'Xin',startMs:s,endMs:s+300}],events:[]});

async function episode(transition){
  const runtime=await previewRuntime(path.resolve('.'));
  const first={...scene('s01'),...(transition?{transition}:{})};
  const full=renderEpisode([{scene:first,time:timing(0,2000)},{scene:scene('s02'),time:timing(2000,4000)}],assets,'light',30,runtime);
  const played=await play(full.html);
  const frames=[...played.document.querySelectorAll('.scene-frame')];
  return {played,out:frames[0],inc:frames[1]};
}

test('page-turn: both scenes are visible around the boundary, the outgoing art turns, and only one scene is visible elsewhere',async()=>{
  const {played,out,inc}=await episode({preset:'page-turn',frames:12});
  const art=frame=>frame.querySelector('.scene-art');
  played.seek(1.0);assert.equal(out.style.opacity,'1');assert.equal(inc.style.opacity,'0');assert.ok(!art(out).style.transform);
  played.seek(1.95);assert.equal(out.style.opacity,'1');assert.equal(inc.style.opacity,'1');   // window is 1.8s..2.2s
  assert.match(art(out).style.transform,/rotateY\(/);
  played.seek(2.1);assert.equal(inc.style.opacity,'1');
  played.seek(3.0);assert.equal(out.style.opacity,'0');assert.equal(inc.style.opacity,'1');assert.ok(!art(inc).style.transform&&!art(out).style.transform);
});

test('cut keeps the hard cut: never two scenes at once',async()=>{
  const {played,out,inc}=await episode({preset:'cut',frames:0});
  for(const t of [1.95,2.0,2.05]){played.seek(t);assert.equal(Number(out.style.opacity)+Number(inc.style.opacity),1,'t='+t);}
});

test('captions never turn with the page: they sit beside the art, and only the scene whose time it is shows one',async()=>{
  const {played,out,inc}=await episode({preset:'page-turn',frames:12});
  const caption=frame=>frame.querySelector('.episode-caption');
  assert.ok(caption(out)&&!caption(out).closest('.scene-art'),'caption is outside the turning art');
  played.seek(1.9);assert.equal(caption(inc).style.display,'none');   // incoming scene has not started yet
  played.seek(2.1);assert.equal(caption(out).style.display,'none');   // outgoing scene is over
});

// ---- enter motion ----------------------------------------------------------------------------------------------
const enter=(over={})=>({id:'in1',target:'actor',motion:'enter',start_frame:0,end_frame:12,params:{from:'left',distance:600},...over});

test('registry: enter is bounded and Studio-only',()=>{
  assert.ok(ACTING.motions.enter);
  assert.ok(ACTING.motions.enter.max_duration_frames<=30);
});

test('enter starts fully displaced on the named side and ends at rest, deterministically',()=>{
  const e=[enter()];
  const start=resolveActing(e,'actor',0),mid=resolveActing(e,'actor',6),end=resolveActing(e,'actor',12);
  assert.equal(start.translateX,-600);assert.equal(start.translateY,0);
  assert.ok(mid.translateX>-600&&mid.translateX<0);
  assert.deepEqual([end.translateX,end.translateY,end.rotateDeg],[0,0,0]);
  assert.deepEqual(resolveActing(e,'actor',6),mid);
  assert.equal(resolveActing([enter({params:{from:'right',distance:500}})],'actor',0).translateX,500);
  assert.equal(resolveActing([enter({params:{from:'top',distance:700}})],'actor',0).translateY,-700);
  assert.equal(resolveActing([enter({params:{from:'bottom',distance:900}})],'actor',0).translateY,900);
});

test('enter keeps the component off-screen until its start frame',()=>{
  const e=[enter({start_frame:20,end_frame:32})];
  assert.equal(resolveActing(e,'actor',5).translateX,-600);
  assert.equal(resolveActing(e,'actor',32).translateX,0);
});

test('validateActingEvent: enter needs a side, a positive bounded distance and an unchanged state',()=>{
  const sc={entities:[{id:'actor',states:{idle:{}}}]};
  const ok={motion:{preset:'enter',duration_frames:12,params:{from:'left',distance:600}},state_before:'idle',state_after:'idle',trigger:{type:'scene_start'}};
  assert.doesNotThrow(()=>validateActingEvent(ok,sc,'actor'));
  assert.throws(()=>validateActingEvent({...ok,motion:{...ok.motion,params:{from:'sideways',distance:600}}},sc,'actor'),/VISUAL_ENTER_FROM_INVALID/);
  assert.throws(()=>validateActingEvent({...ok,motion:{...ok.motion,params:{from:'left',distance:-5}}},sc,'actor'),/VISUAL_ENTER_DISTANCE_INVALID/);
  assert.throws(()=>validateActingEvent({...ok,motion:{...ok.motion,duration_frames:90}},sc,'actor'),/VISUAL_MOTION_DURATION_INVALID/);
  assert.throws(()=>validateActingEvent({...ok,state_after:'other'},sc,'actor'),/VISUAL_ENTER_STATE_CHANGE/);
});

test('validateIntent fills the distance so the component starts fully outside the canvas, and requires scene_start',()=>{
  const narration='Song Tử hỏi thêm câu một. Song Tử hỏi thêm câu hai.';
  const intent=makeFixture(narration,1);
  const target=intent.scenes[0].entities.find(e=>e.kind==='character'||e.id==='gemini')??intent.scenes[0].entities[0];
  const state=target.states[target.initial_state].transform;
  intent.scenes[0].events.unshift({id:'fly',target:target.id,state_before:target.initial_state,state_after:target.initial_state,trigger:{type:'scene_start'},motion:{preset:'enter',duration_frames:12,params:{from:'left'}}});
  validateIntent(intent,narration);
  const distance=intent.scenes[0].events[0].motion.params.distance;
  assert.ok(distance>=state.x+state.width,'distance '+distance+' leaves the component inside the canvas');
  const late=structuredClone(intent);late.scenes[0].events[0].trigger={type:'voice_anchor',text:'Song Tử hỏi thêm câu một.'};
  assert.throws(()=>validateIntent(late,narration),/VISUAL_ENTER_TRIGGER/);
});
