// Generated preview only. Canonical edits always return through the semantic command API.
import {safeSvg,digest} from './visual_candidates.mjs';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {presentationFor,captionCss,watermarkHtml,presentationRuntime,resolveCaptionZone} from './visual_presentation.mjs';
import {planMeasuredCaptionPages,captionCuesForEpisode} from './visual_captions.mjs';
import {openingHtml,openingOpacity,validateSeriesOpening} from './visual_opening.mjs';
import {resolveVisualRole} from '../../runtime/zodiac-renderer/2.0.2/renderer/src/visual-role.mjs';
import {entityBounds,resolveDisplayedEntityState} from '../../runtime/zodiac-renderer/2.0.2/renderer/src/spatial-layout.mjs';
export async function previewRuntime(root){
  const require=createRequire(import.meta.url),studio=require.resolve('@hyperframes/studio/package.json',{paths:[path.join(root,'apps/zodiac-studio')]}),gsap=await readFile(createRequire(studio).resolve('gsap/dist/gsap.min.js'),'utf8');
  const font=await readFile(path.join(root,'runtime/zodiac-renderer/2.0.2/renderer/fonts/PatrickHand-Regular.ttf'));
  return {gsap,font:{base64:font.toString('base64'),sha256:digest(font)}};
}
import {THEMES,resolvePaletteSvg} from './visual_themes.mjs';
export {THEMES} from './visual_themes.mjs';
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const scriptJson=x=>JSON.stringify(x).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
export const hfId=(scene,entity,state)=>'hf-'+digest([scene,entity,state]).slice(0,20);

export function createScenePainter(m,caption){
 const scene=m.scene;let pages=m.captions??null;
 function captions(){
  if(pages)return pages;
  if(!m.words.length)return pages=[];
  const ctx=document.createElement('canvas').getContext('2d');
  if(!ctx)throw Error('CAPTION_MEASUREMENT_UNAVAILABLE');
  ctx.font=`${m.presentation.caption.font_weight} ${m.presentation.caption.font_size_px}px ZodiacCaption`;
  // Pagination follows measured glyph widths, with the pinned Remotion layout algorithm.
  // Token timings include punctuation in the source; lexical subwords share their measured interval.
  const words=m.words.flatMap(w=>{
   const tokens=w.text.match(/[\p{L}\p{N}_]+/gu)??[];
   return tokens.map((text,i)=>({text,start_frame:(w.start+(w.end-w.start)*i/tokens.length)*m.fps,end_frame:(w.start+(w.end-w.start)*(i+1)/tokens.length)*m.fps}));
  });
  if(!words.length)return pages=[];
  const cue={text:m.words.map(w=>w.text).join(' '),words,start_frame:Math.floor(words[0].start_frame),end_frame:Math.ceil(words.at(-1).end_frame)};
  return pages=paginateCaption(scene,m.presentation,{width:1080,height:1920},cue,text=>ctx.measureText(text).width);
 }
 return function paint(t){
  // GSAP stores time to 7 decimals; compensate only that rounding, not a whole frame.
  const frame=Math.min(Math.ceil(m.duration*m.fps)-1,Math.max(0,Math.floor((Number(t)||0)*m.fps+1e-4)));
  if(m.opening){const el=document.getElementById('series-opening');if(el){const fadeAt=m.opening.duration_frames-m.opening.transition_frames;el.style.opacity=frame>=m.opening.duration_frames?'0':frame<=fadeAt?'1':String((m.opening.duration_frames-frame)/m.opening.transition_frames);}}
  const states=Object.fromEntries(scene.entities.map(e=>[e.id,resolveDisplayedEntityState(scene,e,frame)]));
  const order=resolveLayerOrder(scene,{},states);
  for(const [z,e]of order.entries()){
   const state=states[e.id],event=scene.events.find(ev=>ev.target===e.id&&frame>=ev.start_frame&&frame<ev.end_frame),motion=resolveSemanticMotion(event,scene,e,frame);
   for(const [id,s]of Object.entries(e.states)){
    const n=document.getElementById(s.hf_id),active=s.hf_id===state?.hf_id,transform=state?.transform??s.transform;
    n.style.visibility=active&&state.visible!==false?'visible':'hidden';
    n.style.opacity=motion.opacity*(state?.opacity??1);n.style.left=transform.x+'px';n.style.top=transform.y+'px';
    n.style.width=transform.width+'px';n.style.height=transform.height+'px';n.style.zIndex=z;
    n.style.transform=`translate(${motion.translateX}px, ${motion.translateY}px) scale(${(transform.scale??1)*motion.scale}) rotate(${(transform.rotation??0)+motion.rotateDeg}deg)`;
   }
  }
  const cue=captions().find(c=>frame>=c.start_frame&&frame<c.end_frame);
  caption.replaceChildren();if(!cue){caption.style.display='none';return;}
  caption.style.display='block';const b=cue.resolved_layout;
  for(const k of ['x','y','width','height'])caption.style[{x:'left',y:'top',width:'width',height:'minHeight'}[k]]=b[k]+'px';
  const lines=resolveCaptionWordLines(cue,frame);
  lines.forEach((line,i)=>{if(i)caption.appendChild(document.createTextNode('\n'));for(const part of line){const span=document.createElement('span');span.textContent=part.text;span.style.position='relative';span.style.top=-part.lift+'px';if(part.active){span.dataset.captionWord='active';span.style.color=m.presentation.caption.highlight_color;}caption.appendChild(span);}});
 };
}

export function renderPreview(scene, assets, timing, themeId, gsap, font=null, authoredPresentation={}, opening=null) {
  if(opening)validateSeriesOpening(opening,{fps:timing.fps??30});
  const theme=THEMES[themeId];if(!theme)throw Error('VISUAL_THEME_UNKNOWN');
  const presentation=presentationFor(theme,authoredPresentation);
  const duration=(timing.endMs-timing.startMs)/1000,sourceMap=[],clips=[];
  for(const entity of scene.entities) for(const [stateId,state] of Object.entries(entity.states)) {
    const id=hfId(scene.id,entity.id,stateId),t=state.transform??{},asset=assets[state.asset];
    if(!asset)throw Error('VISUAL_ASSET_MISSING '+state.asset);
    safeSvg(Buffer.from(asset.svg));
    sourceMap.push({hf_id:id,scene_id:scene.id,entity_id:entity.id,state_id:stateId,asset_id:state.asset,source_sha256:asset.source_sha256});
    const style=`position:absolute;left:${t.x??0}px;top:${t.y??0}px;width:${t.width??520}px;height:${t.height??520}px;transform-origin:center center;opacity:${state.opacity??1};z-index:${state.layer??20};visibility:hidden;`;
    clips.push(`<div id="${id}" data-hf-id="${id}" data-entity-id="${escape(entity.id)}" data-state-id="${escape(stateId)}" class="entity" style="${style}"><img draggable="false" src="data:image/svg+xml;base64,${Buffer.from(resolvePaletteSvg(asset.svg,themeId)).toString('base64')}" style="width:100%;height:100%;object-fit:contain;pointer-events:none"/></div>`);
  }
  const words=timing.words.map(word=>({...word,start:(word.startMs-timing.startMs)/1000,end:(word.endMs-timing.startMs)/1000}));
  const events=timing.events;
  const captionPages=planMeasuredCaptionPages(scene,{...timing,fps:timing.fps??30},presentation,font?Buffer.from(font.base64,'base64'):null);
  const motions=['state_swap','hold','pop-in','fade-in','fade-out','subtle-tilt','small-bounce','focus-shift','slide'];
  const fps=timing.fps??30;
  const roleAssets=Object.fromEntries(Object.entries(assets).map(([id,a])=>[id,{...a,...a.metadata}]));
  const role=e=>!e.kind&&!e.visual_role&&!roleAssets[e.states[e.initial_state]?.asset]?.category?'overlay':resolveVisualRole(e,roleAssets);
  const model={id:scene.id,duration,fps,motions,presentation,opening,scene:{...scene,start_frame:0,entities:scene.entities.map(e=>({...e,visual_role:role(e),states:Object.fromEntries(Object.entries(e.states).map(([s,v])=>[s,{...v,hf_id:hfId(scene.id,e.id,s)}]))})),events:events.map(e=>({...e,event_id:e.id??e.event_id,start_frame:Math.round(e.at*fps),end_frame:Math.round((e.at+e.preview_duration)*fps),motion:e.preview_motion}))},events,words,captions:captionPages};
  // All executable code below is compiler-owned. Imported SVG is isolated in data images.
  const script=`${presentationRuntime()}const m=${scriptJson(model)};let at=0;const caption=document.getElementById('caption');function start(){
const paint=(${createScenePainter.toString()})(m,caption);
const tl=gsap.timeline({paused:true,onUpdate(){paint(tl.time());}});tl.to({progress:0},{progress:1,duration:m.duration,ease:'none'});window.__timelines=window.__timelines||{};window.__timelines[m.id]=tl;paint(0);
addEventListener('message',e=>{if(e.source!==parent||e.data?.type!=='zodiac-preview')return;if(e.data.action==='seek')tl.seek(Math.max(0,Math.min(m.duration,Number(e.data.time)||0)),false).pause();if(e.data.action==='state'){const n=document.getElementById(e.data.hf_id);if(n){document.querySelectorAll('[data-entity-id]').forEach(x=>{if(x.dataset.entityId===n.dataset.entityId)x.style.visibility=x===n?'visible':'hidden';});}}});
document.addEventListener('click',e=>{const n=e.target.closest('[data-hf-id]');if(n)parent.postMessage({type:'zodiac-preview-select',hf_id:n.dataset.hfId},'*');});parent.postMessage({type:'zodiac-preview-ready',scene_id:m.id},'*');}if(document.fonts)verifyCaptionFont(start);else start();`;
  const nonce=digest([scene.id,themeId,model,sourceMap]).slice(0,24);
  const fontCss=font?`@font-face{font-family:ZodiacCaption;src:url(data:font/ttf;base64,${font.base64}) format('truetype');font-display:block}`:'';
  const html=`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'none'; base-uri 'none'; form-action 'none'"><meta name="viewport" content="width=1080,height=1920"><style>${fontCss}html,body{margin:0;width:1080px;height:1920px;overflow:hidden}#root{position:relative;width:100%;height:100%;background:${presentation.paper};color:${presentation.ink};font-family:ZodiacCaption,Arial,sans-serif}#caption{${captionCss(presentation)}}.entity{cursor:move}.entity img{display:block}.entity:hover{outline:3px solid ${theme.accent}}</style></head><body><div id="root" data-composition-id="${escape(scene.id)}" data-width="1080" data-height="1920" data-duration="${duration}" data-start="0"><section class="clip" data-start="0" data-duration="${duration}" data-track-index="0">${clips.join('')}</section><div id="caption"></div>${openingHtml(opening,theme,scene,assets,themeId)}${watermarkHtml(presentation,escape)}</div><script nonce="${nonce}">${gsap.replaceAll('</script','<\\/script')}</script><script nonce="${nonce}">${script}</script></body></html>`;
  const unsupported_motions=[...new Set(events.filter(e=>!motions.includes(e.preview_motion)).map(e=>e.preview_motion))];
  return {html,clips_html:clips.join(''),render_model:model,source_map:sourceMap,format:'zodiac-hyperframes-source-map@1',theme,font_sha256:font?.sha256??null,
    fidelity:timing.measured===true&&!unsupported_motions.length?'SOURCE_ASSETS_MEASURED_STATE_TIMING':'LEGACY_STATE_ENDPOINTS_ONLY',unsupported_motions,
    renderer_parity:'NOT_ASSERTED',duration_seconds:duration};
}

export function renderEpisode(rows,assets,themeId,fps,runtime,authoredPresentation={},opening=null){
  if(opening)validateSeriesOpening(opening,{fps});
  const theme=THEMES[themeId];if(!theme||![24,30].includes(fps)||!rows.length)throw Error('EXPORT_COMPOSITION_INVALID');
  const presentation=presentationFor(theme,authoredPresentation);
  const duration=rows.at(-1).time.endMs/1000,models=[],clips=[],sourceMap=[],captionRows=[];
  let cursor=0;
  for(const {scene,time}of rows){
    if(time.startMs!==cursor||time.endMs<=time.startMs)throw Error('EXPORT_SCENE_TIMING_GAP');
    cursor=time.endMs;
    const preview=renderPreview(scene,assets,{...time,fps},themeId,runtime.gsap,runtime.font,authoredPresentation,rows[0].scene.id===scene.id?opening:null);
    if(preview.unsupported_motions.length)throw Error('EXPORT_MOTION_UNSUPPORTED');
    models.push({model:preview.render_model,start:time.startMs/1000,end:time.endMs/1000});sourceMap.push(...preview.source_map);
    captionRows.push({time,pages:preview.render_model.captions});
    const id='scene-'+digest(scene.id).slice(0,16);
    clips.push(`<section id="clip-${id}" class="clip" data-start="${time.startMs/1000}" data-duration="${preview.duration_seconds}" data-track-index="0"><div id="${id}" class="scene-frame">${preview.clips_html}<div id="caption-${id}" class="episode-caption"></div></div></section>`);
  }
  const font=runtime.font?`@font-face{font-family:ZodiacCaption;src:url(data:font/ttf;base64,${runtime.font.base64}) format('truetype')}`:'';
  const modelRows=models.map((row,i)=>({...row,root:'scene-'+digest(rows[i].scene.id).slice(0,16)}));
  const script=`${presentationRuntime()}function start(){const rows=${scriptJson(modelRows)},factory=${createScenePainter.toString()};const painters=rows.map(row=>({row,node:document.getElementById(row.root),paint:factory(row.model,document.getElementById('caption-'+row.root))}));function paint(){const at=tl.time();for(const p of painters){const active=at>=p.row.start&&at<p.row.end;p.node.style.opacity=active?'1':'0';if(active)p.paint(at-p.row.start);}}const tl=gsap.timeline({paused:true,onUpdate:paint});tl.to({progress:0},{progress:1,duration:${duration},ease:'none'});window.__timelines=window.__timelines||{};window.__timelines.episode=tl;paint();}if(document.fonts)verifyCaptionFont(start);else start();`;
  const html=`<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>${font}html,body{margin:0;width:1080px;height:1920px;overflow:hidden}#root{position:relative;width:100%;height:100%;background:${presentation.paper};font-family:ZodiacCaption,Arial,sans-serif}.clip,.scene-frame{position:absolute;inset:0;width:100%;height:100%}.entity img{display:block}.episode-caption{${captionCss(presentation)}}</style></head><body><div id="root" data-composition-id="episode" data-width="1080" data-height="1920" data-duration="${duration}" data-fps="${fps}">${clips.join('')}${openingHtml(opening,theme,rows[0].scene,assets,themeId)}${watermarkHtml(presentation,escape)}</div><script>${runtime.gsap.replaceAll('</script','<\\/script')}</script><script>${script}</script></body></html>`;
  return {html,duration_seconds:duration,frames:Math.ceil(duration*fps),source_map:sourceMap,caption_cues:captionCuesForEpisode(captionRows),approval_granted:false};
}

function luminance(hex){const rgb=hex.slice(1).match(/../gu).map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
export function quality(scene,themeId,timing=null){const t=THEMES[themeId],p=presentationFor(t),zone=resolveCaptionZone(scene,p,{width:1080,height:1920}),contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05),issues=[],seen=new Set();
  const add=(code,e,id,frame)=>{const key=[code,e.id,id].join('/');if(!seen.has(key)){seen.add(key);issues.push({code,entity_id:e.id,state_id:id,frame});}};
  function check(e,s,id,frame,sampled){
    if(!s?.transform){add('TRANSFORM_REQUIRED',e,id,frame);return;}
    if(s.visible===false)return;
    const b=entityBounds(sampled,e,s,frame);
    if(b.x<0||b.y<0||b.x+b.width>1080||b.y+b.height>1920)add('OUTSIDE_CANVAS',e,id,frame);
    if(b.x<zone.x+zone.width && b.x+b.width>zone.x && b.y<zone.y+zone.height && b.y+b.height>zone.y && !['background','environment','scene_accent'].includes(e.visual_role??e.kind))add('CAPTION_OCCLUSION',e,id,frame);
  }
  for(const e of scene.entities)for(const [id,s]of Object.entries(e.states))check(e,s,id,0,{...scene,events:[]});
  if(timing){const fps=timing.fps??30,sampled={...scene,events:timing.events.map(e=>({...e,event_id:e.id??e.event_id,start_frame:Math.round(e.at*fps),end_frame:Math.round((e.at+e.preview_duration)*fps),motion:e.preview_motion}))};
    for(let frame=0;frame<Math.ceil((timing.endMs-timing.startMs)/1000*fps);frame++)for(const e of scene.entities){const s=resolveDisplayedEntityState(sampled,e,frame);check(e,s,'timeline',frame,sampled);}
  }
  // Technical validity must never imply a still/mostly-idle scene is engaging.
  // Advisory only: creative decisions remain with the human review gate.
  const actorIds=new Set(scene.entities.filter(e=>e.kind==='character'||e.visual_role==='character').map(e=>e.id));
  const actorBeats=(timing?.events??[]).filter(e=>actorIds.has(e.target)&&e.state_after!==e.state_before);
  const duration=timing?(timing.endMs-timing.startMs)/1000:0;
  const review_warnings=[];
  if(actorIds.size && duration>=7 && actorBeats.length<2)
    review_warnings.push({code:'ACTING_BEATS_SPARSE',detail:'Cảnh dài nhưng ít thay đổi diễn xuất; xem lại nhịp hành động và phản ứng.'});
  return {format:'zodiac-visual-technical-qa@1',status:issues.length?'REVIEW':'PASS',issues,review_warnings,caption_zone:zone,caption_contrast:contrast(t.canvas,t.ink),canvas_contrast:contrast(t.canvas,t.ink),human_review:'PENDING',technical_theme_prototype:true};
}
