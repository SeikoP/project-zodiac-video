#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.argv[2];if(!root){console.error('Usage: node validate-cover-design.mjs <workspace>');process.exit(2);}
const fail=s=>{throw new Error('COVER_DESIGN_INVALID: '+s)};
const p=JSON.parse(await readFile(path.join(root,'publish','publish.json'),'utf8'));
const c=p?.cover;if(!c)fail('cover absent');const d=c.design;
let state;
try{state=JSON.parse(await readFile(path.join(root,'.authoring/pipeline-state.json'),'utf8'));}
catch(error){if(error.code!=='ENOENT')throw error;}
const version=String(state?.plugin_version??'').split('.').map(Number);
const freshOpening=state?.run_mode==='fresh' && (version[0]>2||version[0]===2&&(version[1]>4||version[1]===4&&version[2]>=49));
if(freshOpening&&c.opening===undefined)fail('fresh cover.opening requires explicit enabled choice');
if(c.opening!==undefined){
 const o=c.opening;
 if(!o||typeof o.enabled!=='boolean')fail('opening.enabled');
 if(o.enabled && (typeof o.duration_sec!=='number'||!Number.isFinite(o.duration_sec)||o.duration_sec<0.5||o.duration_sec>3||
 typeof o.transition_sec!=='number'||!Number.isFinite(o.transition_sec)||o.transition_sec<=0||o.transition_sec>0.6||o.transition_sec>=o.duration_sec))fail('opening duration/transition');
}
if(!d){if(process.argv.includes('--allow-legacy')){console.log('COVER_DESIGN_LEGACY_COMPAT');process.exit(0)}fail('new cover.design must be present (use --allow-legacy only for approved legacy)')}
if(d.version!=='zodiac-cover-design@2')fail('design.version');if(d.style_token!=='zodiac-paper-doodle-meme-v4')fail('token');
if(d.canvas?.width!==1080||d.canvas?.height!==1920)fail('canvas');
const f=d.title_frame,m=d.composition;
if(!f||!m)fail('frame/composition missing');
for(const [k,v] of Object.entries({shape:'crooked-paper-note',fill_role:'card',stroke_role:'ink',shadow_role:'soft_shadow',font_family:'Patrick Hand'}))if(f[k]!==v)fail('title_frame.'+k);
const range=(v,l,h,n)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<l||v>h)fail(n)};
range(f.shadow_dx_px,0,4,'shadow dx');range(f.shadow_dy_px,2,8,'shadow dy');range(f.shadow_opacity,0.22,0.38,'shadow opacity');
range(f.max_lines,2,3,'title max_lines');if(!Number.isInteger(f.max_lines))fail('max lines integer');
range(m.hero_scale,0.82,0.90,'hero_scale');range(m.supporting_prop_scale,0.75,0.85,'supporting_prop_scale');range(m.min_side_margin_px,72,160,'min_side_margin_px');
if(m.max_supporting_accents>2||m.max_supporting_accents<0||!Number.isInteger(m.max_supporting_accents))fail('supporting accents');
if(JSON.stringify(m.read_order)!==JSON.stringify(['hook','identity','character_story_object']))fail('read_order');
if(m.background_policy!=='preserve-native-environment')fail('background policy');
if(c.layout!=='tilted_top_hook')fail('legacy layout compatibility');
console.log('COVER_DESIGN_CONTRACT_PASS: runtime pixels unverified');
