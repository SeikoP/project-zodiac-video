import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,mkdtemp,mkdir,cp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveVisualRole,resolveLayer,resolveLayerOrder} from '../src/visual-role.mjs';
import {resolveCaptionZone,resolveCaptionLayout} from '../src/caption-layout.mjs';
import {resolveEntityState,entityBounds,auditSpatialLayout,resolveCoverVisuals} from '../src/spatial-layout.mjs';
import {prepareRendererProps} from '../scripts/prepare.mjs';
import {resolvePreviewEventPairs} from '../scripts/preview.mjs';
import {resolveSemanticMotion} from '../src/semantic-motion.mjs';

const entity=(id,asset,t={},layer)=>({id,initial_state:'idle',states:{idle:{asset,layer,transform:{x:100,y:100,width:200,height:300,...t}}}});
const fixture=()=>({format:'zodiac-render-plan@1',fps:24,video:{width:1080,height:1920},assets:{actor:{category:'character'},board:{category:'environment'},desk:{category:'environment',path:'assets/environment/classroom-desk-edge.svg'},pen:{category:'prop'}},scenes:[{id:'s01',start_frame:0,duration_frames:21,events:[],entities:[]}]});
test('metadata takes priority; binding alone cannot turn environment into prop; unknown role fails',()=>{
  assert.equal(resolveVisualRole(entity('board','board'),fixture().assets),'background');
  assert.equal(resolveVisualRole({...entity('desk','desk'),role:'interactive_prop'},fixture().assets),'interactive_prop');
  assert.equal(resolveVisualRole(entity('desk','desk'),fixture().assets),'foreground_environment');
  assert.throws(()=>resolveVisualRole(entity('mystery','unknown'),{}),/ROLE_RESOLUTION_UNKNOWN/);
  assert.throws(()=>resolveVisualRole({...entity('a','actor'),role:'typo'},fixture().assets),/ROLE_RESOLUTION_INVALID/);
});
test('board stays behind face without authored actor layer; desk stays in front of body',()=>{
  const p=fixture(),s=p.scenes[0];
  s.entities=[entity('character','actor'),entity('board','board',{},2),entity('desk','desk',{y:330,height:100},5)];
  assert.deepEqual(resolveLayerOrder(s,p.assets).map(e=>e.id),['board','character','desk']);
  assert.doesNotThrow(()=>auditSpatialLayout(p));
  s.entities[1].states.idle.layer=30;
  assert.throws(()=>auditSpatialLayout(p),/OCCLUSION_INVALID.*entity=board.*role=background.*layer=30/);
  s.entities[1].states.idle.layer=2;s.entities[2].states.idle.transform.y=100;
  assert.throws(()=>auditSpatialLayout(p),/OCCLUSION_INVALID.*entity=desk.*role=foreground_environment/);
});
test('authored relations override semantic defaults; tie order stable; cycles and wrong layers fail',()=>{
  const p=fixture(),s=p.scenes[0];s.entities=[entity('b','actor'),entity('a','actor'),entity('pen','pen')];
  assert.deepEqual(resolveLayerOrder(s,p.assets).map(e=>e.id),['a','b','pen']);
  s.occlusion_relations=[{front:'a',back:'pen'}];assert.deepEqual(resolveLayerOrder(s,p.assets).map(e=>e.id),['b','pen','a']);
  s.occlusion_relations.push({front:'pen',back:'a'});assert.throws(()=>resolveLayerOrder(s,p.assets),/LAYER_ORDER_CYCLE/);
  assert.throws(()=>resolveLayer(s.entities[0],{layer:'2'},p.assets),/LAYER_ORDER_INVALID/);
});
test('caption sources agree with actual wrapped layout and malformed zones fail',()=>{
  const s=fixture().scenes[0],video={width:1080,height:1920},presentation={caption:{font_size_px:80,max_lines:2,safe_zone:{x:80,y:1300,width:920,height:340}}};
  assert.equal(resolveCaptionZone(s,presentation,video).source,'presentation');
  s.layout_contract={caption_safe_zone:{x:80,y:1320,width:920,height:350}};
  assert.equal(resolveCaptionZone(s,presentation,video).y,1320);
  const wrapped=resolveCaptionLayout(s,presentation,video,'one two three four five',text=>text.length*60);
  assert.equal(wrapped.lines.length,2);assert.ok(wrapped.y+wrapped.height<=1670-12);
  assert.throws(()=>resolveCaptionLayout(s,presentation,video,'one two three four five six seven eight nine ten',text=>text.length*60),/CAPTION_OVERFLOW.*actual_lines=/);
  assert.throws(()=>resolveCaptionLayout(s,presentation,video,'unbreakable',()=>1000),/CAPTION_OVERFLOW/);
  s.layout_contract.caption_safe_zone.x=-1;assert.throws(()=>resolveCaptionZone(s,presentation,video),/CAPTION_SAFE_ZONE_INVALID/);
  delete s.layout_contract;delete presentation.caption.safe_zone;assert.equal(resolveCaptionZone(s,presentation,video).source,'tiktok-default');
});
test('foreground desk collision is caught, decorative background is allowed, hidden state is respected',()=>{
  const p=fixture(),s=p.scenes[0];s.captions=[{start_frame:0,end_frame:21,text:'hello',resolved_layout:resolveCaptionLayout(s,p.presentation,p.video,'hello',()=>100)}];
  const t={x:100,y:1450,width:500,height:300};s.entities=[entity('desk','desk',t)];
  assert.throws(()=>auditSpatialLayout(p),/CAPTION_SAFE_ZONE_BLOCKED.*entity=desk.*role=foreground_environment.*overlap_px=/);
  s.entities=[entity('board','board',t)];assert.doesNotThrow(()=>auditSpatialLayout(p));
  s.entities=[entity('desk','desk',t)];s.entities[0].states.idle.visible=false;assert.doesNotThrow(()=>auditSpatialLayout(p));
});
test('rotation, scale and motion peak collide even when BEFORE and AFTER are clear',()=>{
  const p=fixture(),s=p.scenes[0];s.captions=[{start_frame:0,end_frame:21,text:'hello',resolved_layout:resolveCaptionLayout(s,p.presentation,p.video,'hello',()=>100)}];
  const text=s.captions[0].resolved_layout;
  const e=entity('pen','pen',{x:100,y:text.y+text.height+14,width:200,height:100});s.entities=[e];
  s.events=[{event_id:'bounce',target:'pen',start_frame:0,end_frame:21,state_before:'idle',state_after:'idle',motion:'small-bounce'}];
  assert.equal(entityBounds(s,e,e.states.idle,0).y,e.states.idle.transform.y);
  assert.equal(entityBounds(s,e,e.states.idle,20).y,e.states.idle.transform.y);
  assert.throws(()=>auditSpatialLayout(p),/CAPTION_SAFE_ZONE_BLOCKED.*frame=[1-9]/);
  s.events=[];e.states.idle.transform.rotation=45;assert.throws(()=>auditSpatialLayout(p),/CAPTION_SAFE_ZONE_BLOCKED/);
});
test('state changes inherit the most recent explicit depth; motion does not change it',()=>{
  const p=fixture(),s=p.scenes[0],e=entity('a','actor',{},7);s.entities=[e];
  e.states.second={asset:'actor',layer:12};e.states.third={asset:'actor'};
  s.events=[{target:'a',start_frame:0,end_frame:5,state_after:'second'},{target:'a',start_frame:6,end_frame:10,state_after:'third'}];
  assert.equal(resolveEntityState(s,e,0).layer,7);assert.equal(resolveEntityState(s,e,5).layer,12);assert.equal(resolveEntityState(s,e,15).layer,12);
});
test('cover fits one authored group and preserves relative positions instead of centering every visual',()=>{
  const p=fixture(),s=p.scenes[0];p.assets.actor.src='data:image/svg+xml;base64,AA';p.assets.pen.src='data:image/svg+xml;base64,AA';
  s.entities=[entity('a','actor',{x:140}),entity('b','actor',{x:610}),entity('notebook','pen',{x:410,y:250})];
  const resolved=resolveCoverVisuals(s.entities.map(e=>({entity_id:e.id,state_id:'idle'})),s,p.assets,{width:900,height:720});
  assert.ok(resolved[0].box.x<resolved[2].box.x);assert.ok(resolved[2].box.x<resolved[1].box.x);
  assert.ok(resolved[2].order>resolved[0].order);
});
test('actual eight-scene Job@5 prepares with real font metrics, unchanged timing/motion and S07 contact',async()=>{
  const root=await mkdtemp(join(tmpdir(),'songtu-spatial-'));
  try {
    const source=fileURLToPath(new URL('./fixtures/songtu/',import.meta.url));
    await mkdir(join(root,'.runtime'));await mkdir(join(root,'publish'));
    await cp(join(source,'assets'),join(root,'assets'),{recursive:true});
    const original=JSON.parse(await readFile(join(source,'render-plan.json'),'utf8'));
    await writeFile(join(root,'.runtime/render-plan.json'),JSON.stringify(original));
    await cp(join(source,'publish.json'),join(root,'publish/publish.json'));
    const {props}=await prepareRendererProps(root);
    assert.equal(props.scenes.length,8);
    for(let i=0;i<8;i++) {
      assert.deepEqual(props.scenes[i].events,original.scenes[i].events);
      assert.deepEqual(props.scenes[i].entities,original.scenes[i].entities);
      for(const c of props.scenes[i].captions) {
        assert.deepEqual(c.resolved_layout.zone,resolveCaptionZone(props.scenes[i],props.presentation,props.video));
        assert.ok(c.resolved_layout.lines.length<=2);
      }
    }
    const report=JSON.parse(await readFile(join(root,'.runtime/spatial-qc-report.json'),'utf8'));
    assert.equal(report.frames.length,1189);
    assert.ok(report.frames.every(f=>f.entities.every(e=>!e.caption_overlap_px)));
    const s=props.scenes[6],pen=s.entities.find(e=>e.id==='pen'),event=s.events.find(e=>e.target==='pen' && e.motion==='slide');
    const pair=resolvePreviewEventPairs(s).find(p=>p.event_id===event.event_id);
    const motion=resolveSemanticMotion(event,s,pen,pair.second_frame);
    assert.ok(motion.peak>.98);
    assert.ok(s.entities.find(e=>e.id==='notebook').states.marked.asset.includes('MARKED'));
    const b=entityBounds(s,pen,pen.states.visible,pair.before_frame,props.assets.PROP_PEN),during=entityBounds(s,pen,pen.states.visible,pair.second_frame,props.assets.PROP_PEN);
    assert.ok(Math.hypot(b.x-during.x,b.y-during.y)>24);
  } finally {await rm(root,{recursive:true,force:true});}
});
