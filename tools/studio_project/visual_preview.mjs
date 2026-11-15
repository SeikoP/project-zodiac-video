// Generated preview only. Canonical edits always return through the semantic command API.
import {safeSvg,digest} from './visual_candidates.mjs';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
export async function previewRuntime(root){
  const require=createRequire(import.meta.url),studio=require.resolve('@hyperframes/studio/package.json',{paths:[path.join(root,'apps/zodiac-studio')]}),gsap=await readFile(createRequire(studio).resolve('gsap/dist/gsap.min.js'),'utf8');
  const font=await readFile(path.join(root,'runtime/zodiac-renderer/2.0.2/renderer/fonts/PatrickHand-Regular.ttf'));
  return {gsap,font:{base64:font.toString('base64'),sha256:digest(font)}};
}
export const THEMES={
  light:{format:'zodiac-visual-theme@1',id:'light',canvas:'#fff9ef',ink:'#243540',caption:'#ffffff',caption_ink:'#15232d',accent:'#92502c'},
  dark:{format:'zodiac-visual-theme@1',id:'dark',canvas:'#18232f',ink:'#f6eee3',caption:'#f9f0e3',caption_ink:'#18232f',accent:'#e6b875'},
};
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const scriptJson=x=>JSON.stringify(x).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
export const hfId=(scene,entity,state)=>'hf-'+digest([scene,entity,state]).slice(0,20);

export function renderPreview(scene, assets, timing, themeId, gsap, font=null) {
  const theme=THEMES[themeId];if(!theme)throw Error('VISUAL_THEME_UNKNOWN');
  const duration=(timing.endMs-timing.startMs)/1000,sourceMap=[],clips=[];
  for(const entity of scene.entities) for(const [stateId,state] of Object.entries(entity.states)) {
    const id=hfId(scene.id,entity.id,stateId),t=state.transform??{},asset=assets[state.asset];
    if(!asset)throw Error('VISUAL_ASSET_MISSING '+state.asset);
    safeSvg(Buffer.from(asset.svg));
    sourceMap.push({hf_id:id,scene_id:scene.id,entity_id:entity.id,state_id:stateId,asset_id:state.asset,source_sha256:asset.source_sha256});
    const style=`position:absolute;left:${t.x??0}px;top:${t.y??0}px;width:${t.width??400}px;height:${t.height??400}px;transform:rotate(${t.rotation??0}deg);opacity:${state.opacity??1};z-index:${state.layer??20};visibility:hidden;`;
    clips.push(`<div id="${id}" data-hf-id="${id}" data-entity-id="${escape(entity.id)}" data-state-id="${escape(stateId)}" class="entity" style="${style}"><img draggable="false" src="data:image/svg+xml;base64,${Buffer.from(asset.svg).toString('base64')}" style="width:100%;height:100%;object-fit:contain;pointer-events:none"/></div>`);
  }
  const words=timing.words.map(word=>({...word,start:(word.startMs-timing.startMs)/1000,end:(word.endMs-timing.startMs)/1000}));
  const events=timing.events;
  const motions=['state_swap','hold','pop-in','fade-in','fade-out','subtle-tilt','small-bounce','focus-shift','slide'];
  const model={id:scene.id,duration,motions,entities:scene.entities.map(e=>({id:e.id,initial:e.initial_state,states:Object.fromEntries(Object.entries(e.states).map(([s,v])=>[s,{hf_id:hfId(scene.id,e.id,s),visible:v.visible!==false,opacity:v.opacity??1,transform:v.transform}]))})),events,words};
  // All executable code below is compiler-owned. Imported SVG is isolated in data images.
  const script=`const m=${scriptJson(model)};let at=0;const caption=document.getElementById('caption');
function paint(t){at=Math.max(0,Math.min(m.duration,Number(t)||0));for(const e of m.entities){let active=e.initial,event=null;for(const ev of m.events)if(ev.target===e.id&&ev.at<=at){active=ev.state_after;event=ev;}if(event&&!m.motions.includes(event.preview_motion)&&at<event.at+event.preview_duration)active=event.state_before;for(const [id,s]of Object.entries(e.states)){const n=document.getElementById(s.hf_id);n.style.visibility=id===active&&s.visible?'visible':'hidden';n.style.opacity=s.opacity;n.style.left=s.transform.x+'px';n.style.top=s.transform.y+'px';n.style.transform='rotate('+(s.transform.rotation||0)+'deg)';}
if(event&&event.preview_duration>0&&at<event.at+event.preview_duration){const p=(at-event.at)/event.preview_duration,b=e.states[event.state_before],a=e.states[event.state_after],before=document.getElementById(b.hf_id),after=document.getElementById(a.hf_id),motion=event.preview_motion;
if(motion==='state_swap'){before.style.visibility=b.visible?'visible':'hidden';before.style.opacity=b.opacity*(1-p);after.style.opacity=a.opacity*p;}
if(motion==='fade-in'||motion==='pop-in')after.style.opacity=a.opacity*p;
if(motion==='pop-in')after.style.transform+=' scale('+(0.75+0.25*p)+')';
if(motion==='fade-out'){before.style.visibility=b.visible?'visible':'hidden';before.style.opacity=b.opacity*(1-p);}
if(motion==='small-bounce')after.style.top=(a.transform.y-16*Math.sin(Math.PI*p))+'px';
if(motion==='subtle-tilt')after.style.transform+=' rotate('+(4*Math.sin(Math.PI*2*p))+'deg)';
if(motion==='focus-shift')after.style.transform+=' scale('+(1+0.04*Math.sin(Math.PI*p))+')';
if(motion==='slide'){after.style.left=(b.transform.x+(a.transform.x-b.transform.x)*p)+'px';after.style.top=(b.transform.y+(a.transform.y-b.transform.y)*p)+'px';}}}
const index=m.words.findIndex(w=>w.start<=at&&w.end>at);caption.textContent=index<0?'':m.words.slice(Math.floor(index/6)*6,Math.floor(index/6)*6+6).map(w=>w.text).join(' ');}
const tl=gsap.timeline({paused:true,onUpdate(){paint(tl.time());}});tl.to({progress:0},{progress:1,duration:m.duration,ease:'none'});window.__timelines=window.__timelines||{};window.__timelines[m.id]=tl;paint(0);
addEventListener('message',e=>{if(e.source!==parent||e.data?.type!=='zodiac-preview')return;if(e.data.action==='seek')tl.seek(Math.max(0,Math.min(m.duration,Number(e.data.time)||0))).pause();if(e.data.action==='state'){const n=document.getElementById(e.data.hf_id);if(n){document.querySelectorAll('[data-entity-id]').forEach(x=>{if(x.dataset.entityId===n.dataset.entityId)x.style.visibility=x===n?'visible':'hidden';});}}});
document.addEventListener('click',e=>{const n=e.target.closest('[data-hf-id]');if(n)parent.postMessage({type:'zodiac-preview-select',hf_id:n.dataset.hfId},'*');});parent.postMessage({type:'zodiac-preview-ready',scene_id:m.id},'*');`;
  const nonce=digest([scene.id,themeId,model,sourceMap]).slice(0,24);
  const fontCss=font?`@font-face{font-family:ZodiacCaption;src:url(data:font/ttf;base64,${font.base64}) format('truetype');font-display:block}`:'';
  const html=`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'none'; base-uri 'none'; form-action 'none'"><meta name="viewport" content="width=1080,height=1920"><style>${fontCss}html,body{margin:0;width:1080px;height:1920px;overflow:hidden}#root{position:relative;width:100%;height:100%;background:${theme.canvas};color:${theme.ink};font-family:ZodiacCaption,Arial,sans-serif}#caption{position:absolute;left:80px;right:80px;bottom:200px;text-align:center;font-size:56px;line-height:1.3;color:${theme.caption_ink};background:${theme.caption};border-radius:24px;padding:16px;min-height:72px;z-index:1000;pointer-events:none;white-space:pre-line}.entity{cursor:move}.entity:hover{outline:3px solid ${theme.accent}}</style></head><body><div id="root" data-composition-id="${escape(scene.id)}" data-width="1080" data-height="1920" data-duration="${duration}" data-start="0"><section class="clip" data-start="0" data-duration="${duration}" data-track-index="0">${clips.join('')}</section><div id="caption"></div></div><script nonce="${nonce}">${gsap.replaceAll('</script','<\\/script')}</script><script nonce="${nonce}">${script}</script></body></html>`;
  const unsupported_motions=[...new Set(events.filter(e=>!motions.includes(e.preview_motion)).map(e=>e.preview_motion))];
  return {html,source_map:sourceMap,format:'zodiac-hyperframes-source-map@1',theme,font_sha256:font?.sha256??null,
    fidelity:timing.measured===true&&!unsupported_motions.length?'SOURCE_ASSETS_MEASURED_STATE_TIMING':'LEGACY_STATE_ENDPOINTS_ONLY',unsupported_motions,
    renderer_parity:'NOT_ASSERTED',duration_seconds:duration};
}

function luminance(hex){const rgb=hex.slice(1).match(/../gu).map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
export function quality(scene,themeId){const t=THEMES[themeId],contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05),issues=[];
  for(const e of scene.entities)for(const [id,s]of Object.entries(e.states)){const b=s.transform;if(!b)issues.push({code:'TRANSFORM_REQUIRED',entity_id:e.id,state_id:id});else if(b.x<0||b.y<0||b.x+b.width>1080||b.y+b.height>1920)issues.push({code:'OUTSIDE_CANVAS',entity_id:e.id,state_id:id});else if(s.visible!==false && b.y+b.height>1550 && (s.layer??20)>=1000)issues.push({code:'CAPTION_OCCLUSION',entity_id:e.id,state_id:id});}
  return {format:'zodiac-visual-technical-qa@1',status:issues.length?'REVIEW':'PASS',issues,caption_contrast:contrast(t.caption,t.caption_ink),canvas_contrast:contrast(t.canvas,t.ink),human_review:'PENDING',technical_theme_prototype:true};
}
