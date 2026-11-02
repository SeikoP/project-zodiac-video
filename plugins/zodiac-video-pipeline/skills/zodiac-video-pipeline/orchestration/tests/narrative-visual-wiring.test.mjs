import test from 'node:test';import assert from 'node:assert/strict';
import {validatePhase02ArtDirection} from '../../features/visual-composition/validate-phase02-art-direction.mjs';
import {lintNarrativeVisualAssets} from '../../features/visual-composition/validate-narrative-visual-assets.mjs';

const voice='Cô ấy bỏ lại chiếc ghế trống.';
const palettes={palettes:{warm:{}}};
const production=()=>({scenes:[{id:'S01',voice,entities:[],events:[]}]});
const plan=(extra={})=>({format:'zodiac-scene-art-direction@2',scenes:[{id:'S01',voice,palette_id:'warm',performer:'a',action:'b',semantic_goal:'c',color_reason:'d',visual_coverage:{layers_version:'narrative_visual@1',beats:[{id:'B1',layers:{narrative_visual:{decision:'use',reason:'ghế',entity_ids:['x']}}}]},...extra}]});
const gate=(p,fresh)=>validatePhase02ArtDirection(production(),p,voice,palettes,{profiles:[]},{requireCoverage:fresh,fresh}).issues.map(i=>i.code);

test('fresh run: a beat that uses a narrative visual needs a brief',()=>{
 assert.ok(gate(plan(),true).includes('NARRATIVE_BRIEF_REQUIRED'));
});
test('fresh run: a valid brief satisfies the gate',()=>{
 const brief={format:'zodiac-narrative-brief@1',claim:'Sự vắng mặt nói thay lời',anchor_phrase:'chiếc ghế trống',state_changes:[{from:'có người',to:'trống',anchor_phrase:'bỏ lại'}]};
 assert.ok(!gate(plan({narrative_brief:brief}),true).some(c=>c.startsWith('NARRATIVE_BRIEF')));
});
test('non-fresh workspaces never require a brief',()=>{
 assert.ok(!gate(plan(),false).some(c=>c.startsWith('NARRATIVE_BRIEF')));
});

const svgOk='<svg viewBox="0 0 400 400"><path d="M0 0L10 10"/><path d="M5 5L20 20"/></svg>';
const prod=(transform)=>({assets:{a:{path:'assets/a.svg'}},scenes:[{id:'S01',layout_contract:{caption_safe_zone:{x:0,y:1500,width:1080,height:300}},entities:[
 {id:'n',kind:'narrative_visual',states:{on:{asset:'a',transform}},initial_state:'on'},
 {id:'h',kind:'character',states:{on:{asset:'a',transform}}}]}]});
const codes=async(p,svg=svgOk)=>(await lintNarrativeVisualAssets(p,async()=>svg)).map(i=>i.code);

test('lints narrative visuals only, with scene/entity/state context',async()=>{
 const issues=await lintNarrativeVisualAssets(prod({x:100,y:100,width:100,height:100}),async()=>svgOk);
 assert.deepEqual(issues.map(i=>i.code),['NARRATIVE_KIT_AREA_TOO_SMALL']);
 assert.deepEqual([issues[0].scene_id,issues[0].entity_id,issues[0].state_id],['S01','n','on']);
});
test('passes a large, safe placement',async()=>assert.deepEqual(await codes(prod({x:100,y:300,width:400,height:400})),[]));
test('caption safe zone overlap is reported',async()=>assert.ok((await codes(prod({x:100,y:1400,width:400,height:300}))).includes('NARRATIVE_KIT_CAPTION_SAFE_ZONE_OVERLAP')));
test('an asset that is not authored yet is skipped, not failed',async()=>assert.deepEqual((await lintNarrativeVisualAssets(prod({x:100,y:300,width:400,height:400}),async()=>null)),[]));
test('text glyphs are rejected',async()=>assert.ok((await codes(prod({x:100,y:300,width:400,height:400}),'<svg viewBox="0 0 1 1"><text>hi</text><path d="M0 0"/><path d="M1 1"/></svg>')).includes('NARRATIVE_KIT_TEXT_GLYPHS')));

import {auditNarrativeBriefReuse} from '../../core/audit/audit-creative-reuse.mjs';
test('reuse check flags a repeated claim for editorial review and ignores different ones',()=>{
 const prior=[{episode:'ep-1',scene_id:'S03',claim:'Chiếc ghế trống nói thay sự vắng mặt'}];
 const same=auditNarrativeBriefReuse([{scene_id:'S02',claim:'Sự vắng mặt nói thay bằng chiếc ghế trống'}],prior);
 assert.equal(same.length,1);assert.equal(same[0].code,'NARRATIVE_CONCEPT_REPEATED');assert.equal(same[0].severity,'EDITORIAL_REVIEW');assert.equal(same[0].prior.episode,'ep-1');
 assert.deepEqual(auditNarrativeBriefReuse([{scene_id:'S02',claim:'Đồng hồ chạy ngược khi lo lắng'}],prior),[]);
});
