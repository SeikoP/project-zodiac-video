#!/usr/bin/env node
// Producer-side two-endpoint animation inspection. This is NOT a Remotion frame renderer.
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {traceSceneStates} from './scene-state-trace.mjs';
import {assessSemanticEvent} from './semantic-motion-qa.mjs';
import {previewLineage} from '../../core/evidence/preview-lineage.mjs';

const fail=(code,message)=>{throw new Error(`${code}: ${message}`)};
const sha=x=>createHash('sha256').update(x).digest('hex');
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const validId=s=>typeof s==='string' && /^[a-zA-Z0-9_-]{1,110}$/.test(s);
const usableBox=t=>t && ['x','y','width','height'].every(k=>Number.isFinite(t[k])) && t.width>0 && t.height>0 && t.x>=0 && t.y>=0 && t.x+t.width<=1080 && t.y+t.height<=1920;
const eventPreset=e=>e.motion?.preset??e.desired_motion;
const ordered=(arr)=>[...arr].sort((a,b)=>(a.layer??0)-(b.layer??0));
async function svgUrl(root,assetId,assets,cache){
 const a=assets?.[assetId];if(!a?.path)fail('PREVIEW_ASSET_MISSING',`${assetId} lacks asset path`);
 const rel=a.path.replaceAll('\\','/');if(rel.startsWith('/')||rel.split('/').includes('..')||rel.includes(':')||!rel.toLowerCase().endsWith('.svg'))fail('PREVIEW_ASSET_PATH_UNSAFE',rel);
 const abs=path.resolve(root,rel);const real=await realpath(abs);if(!real.startsWith(path.resolve(root)+path.sep))fail('PREVIEW_ASSET_PATH_UNSAFE',rel);
 if(!cache.has(real)){
  const svg=await readFile(real,'utf8');if(!/<svg\b/u.test(svg)||/<script\b|<foreignObject\b|\bon\w+\s*=|\bhref\s*=\s*["']https?:/iu.test(svg))fail('PREVIEW_SVG_UNSAFE',rel);
  cache.set(real,{markup:svg,sha256:sha(svg)});
 }
 return cache.get(real);
}
function stateOf(e,key){const st=e.states?.[key];if(!st)fail('PREVIEW_EVENT_STATE_MISSING',`${e.id}.${key}`);return st;}
async function frameHtml(root,scene,target,event,phase,assets,cache,assessment,states){
 const eids=new Set();const items=[];
 for(const e of scene.entities??[]){
  if(!validId(e.id)||eids.has(e.id))fail('PREVIEW_ENTITY_ID_INVALID',`${scene.id}/${e.id}`);eids.add(e.id);
  const stid=states[e.id];
  const st=stateOf(e,stid);if(st.visible===false)continue;
  let b=st.transform;if(e.id===target.id&&phase==='after'&&assessment.kind==='motion_only'){
   const preset=eventPreset(event);const d=assessment.expected_motion;
   if(preset==='slide'){b={...b,x:b.x+d.delta_px.x,y:b.y+d.delta_px.y};}
  }
  if(!usableBox(b))fail('PREVIEW_TRANSFORM_INVALID',`${scene.id}/${e.id}/${stid}`);
  const svg=await svgUrl(root,st.asset,assets,cache);
  const preset=e.id===target.id&&phase==='after'&&assessment.kind==='motion_only'?eventPreset(event):null;
  const effect=preset==='subtle-tilt'?'transform:rotate(3.5deg);transform-origin:50% 50%;':preset==='small-bounce'?'transform:translateY(-20px);':preset==='focus-shift'?'transform:scale(1.06);transform-origin:50% 50%;':'';
  const layer=st.layer??(e.kind==='character'?15:e.kind==='effect'?27:7);
  // Inline the canonical SVG itself. Nested iframe and data: URLs are blocked in many artifact viewers.
  // A wrapper owns coordinates, CSS motion and QA attributes; inner SVG remains byte-identical to the asset.
  const svgMarkup=svg.markup.replace(/<svg\b/u,'<svg preserveAspectRatio="none" style="display:block;width:100%;height:100%"');
  items.push({layer,html:`<div role="img" aria-label="${esc(e.id)}:${esc(stid)}" data-entity="${esc(e.id)}" data-state="${esc(stid)}" data-sha="${svg.sha256}" style="position:absolute;left:${b.x}px;top:${b.y}px;width:${b.width}px;height:${b.height}px;z-index:${layer};${effect}">${svgMarkup}</div>`});
 }
 if(!eids.has(target.id))fail('PREVIEW_EVENT_TARGET_MISSING',`${scene.id}/${target.id}`);
 const meta=`${esc(scene.id)} / ${esc(event.id)} · ${phase==='before'?'BEFORE':'AFTER'}`;
 return `<!doctype html><html lang="vi"><meta charset="utf-8"><title>${meta}</title><style>*{box-sizing:border-box}html,body{margin:0;background:#f6f0e6}.canvas{position:relative;width:1080px;height:1920px;overflow:hidden;background:#f6f0e6}.meta{position:absolute;left:20px;top:10px;z-index:100;font:26px sans-serif;color:#2f3c44;background:#fffdf9db;padding:8px}</style><div class="canvas">${ordered(items).map(x=>x.html).join('')}<div class="meta">${meta}</div></div></html>`;
}
async function sceneFrameHtml(root,scene,states,assets,cache,label){
 const ids=new Set(),items=[];
 for(const e of scene.entities??[]){
  if(!validId(e.id)||ids.has(e.id))fail('PREVIEW_ENTITY_ID_INVALID',scene.id+'/'+e.id);ids.add(e.id);
  const stid=states[e.id]??e.initial_state;if(!stid)fail('PREVIEW_SCENE_STATE_MISSING',scene.id+'/'+e.id);
  const st=stateOf(e,stid);if(st.visible===false)continue;const b=st.transform;if(!usableBox(b))fail('PREVIEW_TRANSFORM_INVALID',scene.id+'/'+e.id+'/'+stid);
  const svg=await svgUrl(root,st.asset,assets,cache);const layer=st.layer??(e.kind==='character'?15:e.kind==='effect'?27:7);
  const svgMarkup=svg.markup.replace(/<svg\b/u,'<svg preserveAspectRatio="none" style="display:block;width:100%;height:100%"');
  items.push({layer,html:'<div role="img" aria-label="'+esc(e.id)+':'+esc(stid)+'" data-entity="'+esc(e.id)+'" data-state="'+esc(stid)+'" data-sha="'+svg.sha256+'" style="position:absolute;left:'+b.x+'px;top:'+b.y+'px;width:'+b.width+'px;height:'+b.height+'px;z-index:'+layer+'">'+svgMarkup+'</div>'});
 }
 const meta=esc(scene.id)+' · SCENE '+esc(label);
 return '<!doctype html><html lang="vi"><meta charset="utf-8"><title>'+meta+'</title><style>*{box-sizing:border-box}html,body{margin:0;background:#f6f0e6}.canvas{position:relative;width:1080px;height:1920px;overflow:hidden;background:#f6f0e6}.meta{position:absolute;left:20px;top:10px;z-index:100;font:26px sans-serif;color:#2f3c44;background:#fffdf9db;padding:8px}</style><div class="canvas">'+ordered(items).map(x=>x.html).join('')+'<div class="meta">'+meta+'</div></div></html>';
}
export async function buildNativePairs(workspace,{outDir=path.join(workspace,'.authoring','preview-pairs'),inputFile=null}={}){
 const root=path.resolve(workspace);const file=inputFile??(await readFile(path.join(root,'production.json'),'utf8').then(()=>path.join(root,'production.json')).catch(()=>path.join(root,'production.ir.json')));
 const authoring_lineage=await previewLineage(root);
 const raw=await readFile(file,'utf8');const production=JSON.parse(raw);const isJob5=production.format?.startsWith('zodiac-authoring-ir@')??false;
 if(!Array.isArray(production.scenes)||!production.scenes.length)fail('PREVIEW_SCENES_MISSING','No scenes');
 if(!production.assets||typeof production.assets!=='object')fail('PREVIEW_ASSETS_MISSING','No asset registry');
 const out=path.resolve(outDir);await mkdir(out,{recursive:true});const cache=new Map(),pairs=[],sceneFrames=[],allNames=new Set(),frameCanvases=new Map();
 for(const scene of production.scenes){if(!validId(scene.id))fail('PREVIEW_SCENE_ID_INVALID',String(scene.id));if(!Array.isArray(scene.events))fail('PREVIEW_EVENTS_MISSING',scene.id);
  for(const ev of scene.events)if(!(scene.entities??[]).some(e=>e.id===ev.target))fail('PREVIEW_EVENT_TARGET_MISSING',scene.id+'/'+ev.id);const traces=traceSceneStates(scene);
  for(const [eventIndex,ev] of scene.events.entries()){if(!validId(ev.id))fail('PREVIEW_EVENT_ID_INVALID',String(ev.id));const key=`${scene.id}_${ev.id}`;if(allNames.has(key))fail('PREVIEW_DUPLICATE_EVENT',key);allNames.add(key);
   const e=(scene.entities??[]).find(x=>x.id===ev.target);if(!e)fail('PREVIEW_EVENT_TARGET_MISSING',`${scene.id}/${ev.id}/${ev.target}`);
   const before=stateOf(e,ev.state_before),after=stateOf(e,ev.state_after),motion=eventPreset(ev);
   const assessment=assessSemanticEvent(scene,ev);
   if(typeof motion!=='string'||!motion.trim())fail('PREVIEW_MOTION_MISSING',`${scene.id}/${ev.id}`);
   if(!before.asset||!after.asset)fail('PREVIEW_EVENT_ASSET_MISSING',key);
   const names={before:`${key}-before.html`,after:`${key}-after.html`};
   const previews={};for(const phase of ['before','after']){const html=await frameHtml(root,scene,e,ev,phase,production.assets,cache,assessment,traces[eventIndex][phase]);await writeFile(path.join(out,names[phase]),html,'utf8');previews[phase+'_sha256']=sha(html);frameCanvases.set(names[phase],html.slice(html.indexOf('<div class="canvas">'),html.lastIndexOf('</html>')));}
   pairs.push({scene_id:scene.id,event_id:ev.id,target:ev.target,cumulative_before:traces[eventIndex].before,cumulative_after:traces[eventIndex].after,trigger:ev.trigger,motion,animation_duration_frames:ev.motion?.duration_frames??null,source_contract:isJob5?'zodiac-job@5':'production@2.0',state_before:ev.state_before,state_after:ev.state_after,kind:assessment.kind,expected_motion:assessment.expected_motion,before:names.before,after:names.after,...previews,can_verify_geometry:assessment.kind!=='static_hold',runner_motion_check_required:assessment.runner_motion_check_required});
  }
  const initialStates=traces[0]?.before??Object.fromEntries((scene.entities??[]).map(e=>[e.id,e.initial_state]));
  const finalStates=traces.at(-1)?.after??initialStates;
  const sceneNames={before:'scene-'+scene.id+'-before.html',after:'scene-'+scene.id+'-after.html'},sceneHashes={};
  for(const phase of ['before','after']){const states=phase==='before'?initialStates:finalStates;const html=await sceneFrameHtml(root,scene,states,production.assets,cache,phase.toUpperCase());await writeFile(path.join(out,sceneNames[phase]),html,'utf8');sceneHashes[phase+'_sha256']=sha(html);frameCanvases.set(sceneNames[phase],html.slice(html.indexOf('<div class="canvas">'),html.lastIndexOf('</html>')));}
  sceneFrames.push({scene_id:scene.id,before:sceneNames.before,after:sceneNames.after,initial_states:initialStates,final_states:finalStates,...sceneHashes});
 }
 if(!pairs.length)fail('PREVIEW_EVENTS_EMPTY','No semantic events to inspect');
 // A single-file viewer: no iframe, no data: image, no external image or script requests.
 const panel=(name,phase,state)=>`<figure><div class="view" data-preview-frame="${esc(name)}"><div class="scaled">${frameCanvases.get(name)}</div></div><figcaption>${phase} · ${esc(state)}</figcaption></figure>`;
 const sceneRows=sceneFrames.map(p=>`<section><h2>${esc(p.scene_id)} — complete scene</h2><p>Full composition at scene entry and after the final semantic event.</p><div class="pair">${panel(p.before,'SCENE BEFORE','all authored entities')}${panel(p.after,'SCENE AFTER','all authored entities')}</div></section>`).join('');
 const rows=pairs.map(p=>`<section><h2>${esc(p.scene_id)} · ${esc(p.event_id)} — ${esc(p.target)}</h2><p>Preset: <b>${esc(p.motion)}</b> · ${p.kind==='motion_only'?'Authored peak-motion cue, temporal/easing parity must be checked in runner':p.kind==='static_hold'?'Static hold: intentional pose, not animated':p.kind==='actor_state_slide'?'Authored slide endpoints; temporal/easing QA required in runner':'Authored state/visibility change'}</p><div class="pair">${panel(p.before,'BEFORE',p.state_before)}${panel(p.after,'AFTER',p.state_after)}</div></section>`).join('');
 const html=`<!doctype html><html lang="vi"><meta charset="utf-8"><title>Native scene-complete + semantic preview</title><meta name="viewport" content="width=device-width"><style>*{box-sizing:border-box}body{margin:16px auto;padding:0 16px;max-width:1100px;background:#f6f0e6;color:#2f3c44;font:15px system-ui}section{border-top:2px solid #d0c1b3;margin:18px 0;padding:6px 0}h2{font-size:18px}.pair{display:flex;flex-wrap:wrap;gap:14px}figure{margin:0;background:#fffdf9;padding:10px}.view{width:270px;height:480px;overflow:hidden;border:1px solid #d0c1b3}.scaled{width:1080px;height:1920px;transform:scale(.25);transform-origin:top left}.canvas{position:relative;width:1080px;height:1920px;overflow:hidden;background:#f6f0e6}.meta{position:absolute;left:20px;top:10px;z-index:100;font:26px sans-serif;color:#2f3c44;background:#fffdf9db;padding:8px}figcaption{text-align:center;font-weight:700;padding-top:4px}</style><h1>Scene-complete visual review</h1><p>All authored entities are shown for every scene before/after its semantic event chain. Uses EXACT production asset SVGs and authored transforms.</p><main>${sceneRows}</main><h1>Event semantic endpoint pairs</h1><p>These are <b>semantic endpoints, not timed Remotion frames.</b> Motion-only events still require runner temporal QA.</p><main>${rows}</main></html>`;
 await writeFile(path.join(out,'index.html'),html,'utf8');
 const receipt={format:'zodiac-native-preview-pairs@2',source: path.relative(root,file),source_sha256:sha(raw),scope:'native_visual_review_only',renderer_faithful:false,review_surface:'scene_complete_plus_event_pairs',description:'Complete scene entry/final snapshots plus two authored semantic endpoint snapshots per event. Runtime frames and motion-only visual amplitudes are local-runner owned.',scene_count:production.scenes.length,scene_frames:sceneFrames,scene_frame_files:sceneFrames.length*2,event_pairs:pairs.length,frame_files:pairs.length*2,motion_only_count:pairs.filter(x=>x.kind==='motion_only').length,static_hold_count:pairs.filter(x=>x.kind==='static_hold').length,transition_count:pairs.filter(x=>['state_or_visibility_change','actor_state_slide'].includes(x.kind)).length,asset_count:cache.size,assets_sha256:Object.fromEntries([...cache].map(([abs,value])=>[path.relative(root,abs).replaceAll('\\','/'),value.sha256])),index_sha256:sha(html),pairs};
 if(authoring_lineage)receipt.authoring_lineage=authoring_lineage;
 receipt.structural_status='STRUCTURAL_PASS';receipt.creative_status='CREATIVE_REVIEW_REQUIRED';receipt.runtime_status='RUNTIME_QA_PENDING';
 await writeFile(path.join(out,'preview-report.json'),JSON.stringify(receipt,null,2)+'\n','utf8');
 return receipt;
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){const workspace=process.argv[2];if(!workspace){console.error('Usage: node build-native-preview-pairs.mjs <package-root> [out-dir]');process.exit(2);}try{const receipt=await buildNativePairs(workspace,{outDir:process.argv[3]??undefined});console.log(`NATIVE_PAIR_PREVIEW_PASS pairs=${receipt.event_pairs} frames=${receipt.frame_files} motion_only=${receipt.motion_only_count} static_hold=${receipt.static_hold_count}`);}catch(e){console.error(e.message);process.exit(1);}}
