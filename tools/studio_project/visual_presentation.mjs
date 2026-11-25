// Compatibility adapter: reuse the pinned renderer's algorithms, never a second motion engine.
import {readFileSync} from 'node:fs';
import {resolveEntityState,resolveDisplayedEntityState} from '../../runtime/zodiac-renderer/2.0.2/renderer/src/spatial-layout.mjs';
import {resolveVisualRole,resolveLayer,resolveLayerOrder} from '../../runtime/zodiac-renderer/2.0.2/renderer/src/visual-role.mjs';
import {MOTION_STEP_FRAMES,steppedMotionFrame,resolveSemanticMotion} from '../../runtime/zodiac-renderer/2.0.2/renderer/src/semantic-motion.mjs';
import {resolveActing,resolveCamera} from './visual_acting.mjs';
import {paintTransition,resetTransition} from './visual_transitions.mjs';
import {resolveCaptionZone,resolveCaptionLayout,paginateCaption} from '../../runtime/zodiac-renderer/2.0.2/renderer/src/caption-layout.mjs';
import {CAPTION_STROKE_PX,CAPTION_STROKE_COLOR,CAPTION_BOUNCE_PX,validateCaptionWords,resolveCaptionWordLines} from '../../runtime/zodiac-renderer/2.0.2/renderer/src/caption-karaoke.mjs';
export {resolveCaptionZone};
const token=JSON.parse(readFileSync(new URL('../../plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4/foundations/style-token.json',import.meta.url)));
export const VISUAL_CONTRACT=JSON.parse(readFileSync(new URL('./visual_contract.json',import.meta.url)));
export const PRESENTATION={paper:token.palette_roles.paper,ink:token.palette_roles.ink,
 caption:{...VISUAL_CONTRACT.caption,color:token.palette_roles.ink,highlight_color:token.palette_roles.coral},
 watermark:VISUAL_CONTRACT.watermark};

export function presentationFor(theme,authored={}){
 return {...PRESENTATION,...authored,paper:authored.paper??theme.canvas,ink:authored.ink??theme.ink,
  caption:{...PRESENTATION.caption,color:theme.ink,highlight_color:theme.accent,...authored.caption},
  watermark:{...PRESENTATION.watermark,...authored.watermark}};
}
export function captionCss(p){const c=p.caption;return `position:absolute;text-align:center;font-family:ZodiacCaption;font-size:${c.font_size_px}px;font-weight:${c.font_weight};line-height:${c.line_height};color:${c.color};-webkit-text-stroke:${CAPTION_STROKE_PX}px ${CAPTION_STROKE_COLOR};text-shadow:0px 2px 3px rgba(47,60,68,.18);paint-order:stroke fill;white-space:pre;overflow:visible;z-index:90;pointer-events:none`;
}
export function watermarkHtml(p,escape){const w=p.watermark;if(!w.enabled||!w.text)return '';const star=w.text.trim().startsWith('✦');return `<div data-watermark="brand" style="position:absolute;left:${w.offset_px.x}px;top:${w.offset_px.y}px;font-family:${escape(w.font_family)};font-size:${w.font_size_px}px;font-weight:${w.font_weight};opacity:${w.opacity};color:${p.ink};z-index:${w.layer};display:flex;align-items:center;gap:5px;pointer-events:none">${star?'<svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0 L15.2 8.8 L24 12 L15.2 15.2 L12 24 L8.8 15.2 L0 12 L8.8 8.8 Z"/></svg>':''}<span>${escape(star?w.text.trim().slice(1).trimStart():w.text)}</span></div>`;}

// Browser source is emitted from the imported functions themselves. Changes in the pinned
// renderer are fingerprinted by visual_compiler and exercised against its real React render.
export function presentationRuntime(){return `
const clamp=n=>Math.max(0,Math.min(1,n));
const MOTION_STEP_FRAMES=${MOTION_STEP_FRAMES},CAPTION_STROKE_PX=${CAPTION_STROKE_PX},CAPTION_BOUNCE_PX=${CAPTION_BOUNCE_PX};
const aliases={environment:'background',environment_cue:'background',character_pose:'character',prop:'interactive_prop',object:'interactive_prop',story_prop:'story_object',story_effect:'effect',story_symbol:'story_object'};
const roles=new Set(['background','character','interactive_prop','foreground_environment','story_object','story_symbol','effect','caption','overlay']);
function verifyCaptionFont(start){
 document.fonts.load('84px "ZodiacCaption"').then(faces=>{
  if(!faces.some(face=>face.family.replaceAll('"','')==='ZodiacCaption'&&face.status==='loaded')||!document.fonts.check('84px "ZodiacCaption"'))
   throw Error('FONT_LOAD_FAILED requested=ZodiacCaption actual=unavailable fallback=false');
  window.__captionFontVerified=true;start();
 }).catch(error=>{window.__renderError=String(error);console.error(error);throw error;});
}
${[steppedMotionFrame,resolveActing,resolveCamera,resolveSemanticMotion,resolveEntityState,resolveDisplayedEntityState,resolveVisualRole,resolveLayer,resolveLayerOrder,resolveCaptionZone,resolveCaptionLayout,paginateCaption,validateCaptionWords,resolveCaptionWordLines,paintTransition,resetTransition].map(f=>'const '+f.name+'='+f.toString()+';').join('\n')}
`;}
