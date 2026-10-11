import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {projectProduction} from '../compile-runtime-production.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const refs=path.resolve(here,'../../references');

test('runtime projection carries exact demo font stack and canonical ✦ bungmoto overlay',async()=>{
  const design=await readFile(path.join(refs,'design.md'),'utf8');
  const out=projectProduction({version:'2.0',assets:{},scenes:[]},design);
  assert.deepEqual(out.caption_style.font_stack,['Patrick Hand','Segoe Print','cursive']);
  assert.equal(out.caption_style.css_font_family,'"Patrick Hand", "Segoe Print", cursive');
  assert.deepEqual(out.visual_system.brand_overlay,{
    enabled:true,text:'✦ bungmoto',symbol:'✦',brand:'bungmoto',anchor:'top-left',
    offset_px:{x:68,y:40},font_family:'Patrick Hand',font_stack:['Patrick Hand','Segoe Print','cursive'],
    css_font_family:'"Patrick Hand", "Segoe Print", cursive',font_size_px:29,font_weight:800,
    symbol_scale:0.82,gap_px:18,opacity:0.45,tone:'ink',paper_halo:true,layer:30,subtitle_layer:40
  });
});
