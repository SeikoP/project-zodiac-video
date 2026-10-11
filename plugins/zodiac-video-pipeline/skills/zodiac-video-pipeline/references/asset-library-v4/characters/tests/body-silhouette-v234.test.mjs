import test from 'node:test';
import assert from 'node:assert/strict';
import {compileCharacterSvg} from '../compile-character-assembly.mjs';
const make=(body_profile)=>compileCharacterSvg({entity_id:'body-test',body_profile,hair_id:'side-part',outfit_id:'generic-soft-stripes',shirt_color_id:'teal'},{pose_id:'neutral',expression_id:'neutral'}).svg;
const leg=(s)=>s.match(/<g id="left_leg"><path d="([^"]+)/)?.[1];
test('distinct native lower-body geometry and no whole-SVG scale',()=>{
 const std=make('standard_compact'),tall=make('lean_tall'),short=make('petite_compact'),stocky=make('stocky_short');
 assert.notEqual(leg(std),leg(tall));assert.notEqual(leg(std),leg(short));assert.notEqual(leg(stocky),leg(tall));
 assert.match(tall,/body_geometry=authored-limb-reach-v2/);
 for(const svg of [std,tall,short,stocky]){assert.match(svg,/viewBox="0 0 520 760"/);assert.doesNotMatch(svg,/<g[^>]+transform="scale/);}
});
