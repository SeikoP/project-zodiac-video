import test from 'node:test';import assert from 'node:assert/strict';
import {validateNarrativeVisualKit as lint} from '../../features/visual-composition/validate-narrative-visual-kit.mjs';
const good='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><path d="M10 10L200 40" fill="none" stroke="#2F3A4A" stroke-width="4"/><path d="M20 200C80 120 160 260 300 180" fill="#F2E8D5" stroke="#2F3A4A" stroke-width="4"/></svg>';
const o={palette:['#2f3a4a','#F2E8D5'],strokeWidths:[4,6],canvas:{width:1080,height:1920},rect:{x:100,y:300,width:400,height:300},captionSafeZone:{x:0,y:1500,width:1080,height:300}};
const codes=(svg,opt=o)=>lint(svg,opt).map(i=>i.code);
test('a clean hand-drawn visual passes',()=>assert.deepEqual(codes(good),[]));
test('non-svg input is rejected',()=>assert.deepEqual(codes('hi'),['NARRATIVE_KIT_NOT_SVG']));
test('text glyphs are forbidden (words belong to captions)',()=>assert.ok(codes(good.replace('</svg>','<text x="1" y="1">hi</text></svg>')).includes('NARRATIVE_KIT_TEXT_GLYPHS')));
test('filters, turbulence, scripts and animation are forbidden (Human Stroke v2)',()=>{
 for(const bad of ['<filter id="f"><feTurbulence/></filter>','<script>1</script>','<animate attributeName="x"/>','<image href="a.png"/>'])
  assert.ok(codes(good.replace('</svg>',bad+'</svg>')).includes('NARRATIVE_KIT_FORBIDDEN_ELEMENT'),bad);
});
test('missing or zero viewBox is rejected',()=>{assert.ok(codes(good.replace(/viewBox="[^"]+"/,'')).includes('NARRATIVE_KIT_VIEWBOX_INVALID'));});
test('colors must come from the style palette',()=>assert.ok(codes(good.replace('#F2E8D5','#FF00FF')).includes('NARRATIVE_KIT_COLOR_OFF_PALETTE')));
test('three-digit hex and none are accepted',()=>assert.deepEqual(codes(good.replaceAll('#2F3A4A','#234'),{...o,palette:['#223344','#F2E8D5']}),[]));
test('stroke widths must be style tokens',()=>assert.ok(codes(good.replace('stroke-width="6"','').replace('stroke-width="4"','stroke-width="5"')).includes('NARRATIVE_KIT_STROKE_OFF_TOKEN')));
test('a visual of geometric primitives only is not authored focal geometry',()=>assert.ok(codes('<svg viewBox="0 0 10 10"><rect width="5" height="5"/><circle r="2"/></svg>',{}).includes('NARRATIVE_KIT_FOCAL_PATHS_TOO_FEW')));
test('placement must meet the minimum area',()=>assert.ok(codes(good,{...o,rect:{x:0,y:0,width:100,height:100}}).includes('NARRATIVE_KIT_AREA_TOO_SMALL')));
test('placement must stay on canvas and off the caption safe zone',()=>{
 assert.ok(codes(good,{...o,rect:{x:900,y:300,width:400,height:300}}).includes('NARRATIVE_KIT_OUT_OF_CANVAS'));
 assert.ok(codes(good,{...o,rect:{x:100,y:1400,width:400,height:300}}).includes('NARRATIVE_KIT_CAPTION_SAFE_ZONE_OVERLAP'));
});
test('placement checks are skipped when no placement is given',()=>assert.deepEqual(codes(good,{palette:o.palette}),[]));
