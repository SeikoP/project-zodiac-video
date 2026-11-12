import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateVisualCoverage,coverageLayers} from '../../features/visual-composition/validate-visual-coverage.mjs';

const voice='Một câu rõ nghĩa.';
const hidden=(reason='Không dùng lớp này.')=>({decision:'omit',reason});
function fixture(){
 const actor={id:'actor',kind:'character',initial_state:'on',states:{on:{visible:true}}};
 const scene={id:'S01',voice,entities:[actor],events:[],layout_contract:{caption_safe_zone:{x:80,y:1400,width:920,height:300}},spatial_bindings:[]};
 const layers=Object.fromEntries(coverageLayers.map(k=>[k,hidden()]));
 layers.actors={decision:'use',reason:'Nhân vật thực hiện câu chuyện.',entity_ids:['actor']};
 const planned={components:[{id:'actor',visual_role:'character'}],visual_coverage:{format:'zodiac-visual-coverage@1',layers_version:'narrative_visual@1',narration_sha256:createHash('sha256').update(voice).digest('hex'),beats:[{id:'B1',goal:'Diễn ý chính.',narration_range:[0,Buffer.byteLength(voice)],event_ids:[],layers}]}};
 return {scene,planned};
}
const codes=(f)=>validateVisualCoverage(f.scene,f.planned,{required:true}).map(x=>x.code);

test('current coverage has one Narrative Visual layer and no Story Object layer',()=>{
 assert.deepEqual(coverageLayers,['actors','scene_accent','narrative_visual','props','support','caption']);
 assert.equal(coverageLayers.includes('story_object'),false);
});
test('current minimal coverage passes without Narrative Visual quota',()=>assert.deepEqual(codes(fixture()),[]));
test('missing current layer decision blocks',()=>{const f=fixture();delete f.planned.visual_coverage.beats[0].layers.narrative_visual;assert.ok(codes(f).includes('COVERAGE_LAYER_DECISION_MISSING'));});
test('stale narration hash blocks',()=>{const f=fixture();f.planned.visual_coverage.narration_sha256='stale';assert.ok(codes(f).includes('COVERAGE_NARRATION_STALE'));});
test('Narrative Visual and Story Text cannot be used in the same beat',()=>{
 const f=fixture(),nv={id:'nv',kind:'object',initial_state:'on',states:{on:{visible:true}}},txt={id:'txt',kind:'object',initial_state:'on',states:{on:{visible:true}}};
 f.scene.entities.push(nv,txt);f.planned.components.push({id:'nv',narrative_role:'narrative_visual',visual_role:'narrative_visual'},{id:'txt',visual_role:'overlay'});
 const l=f.planned.visual_coverage.beats[0].layers;
 l.narrative_visual={decision:'use',reason:'Hình giải thích trọng tâm.',entity_ids:['nv']};
 l.story_text={decision:'use',reason:'Chữ cũng giải thích trọng tâm.',entity_ids:['txt']};
 assert.ok(codes(f).includes('COVERAGE_STORY_FOCUS_CONFLICT'));
});
test('Narrative Visual and Story Text cannot split ownership across beats in one scene',()=>{
 const f=fixture();f.scene.voice='Một. Hai.';f.planned.visual_coverage.narration_sha256=createHash('sha256').update(f.scene.voice).digest('hex');
 const nv={id:'nv',kind:'object',initial_state:'on',states:{on:{visible:true}}},txt={id:'txt',kind:'object',initial_state:'off',states:{off:{visible:false}}};
 f.scene.entities.push(nv,txt);f.planned.components.push({id:'nv',narrative_role:'narrative_visual',visual_role:'narrative_visual'},{id:'txt',visual_role:'overlay'});
 const first=JSON.parse(JSON.stringify(f.planned.visual_coverage.beats[0])),cut=Buffer.byteLength('Một. ');
 first.id='B1';first.narration_range=[0,cut];first.layers.narrative_visual={decision:'use',reason:'Hình sở hữu scene.',entity_ids:['nv']};first.layers.story_text=hidden();
 const second=JSON.parse(JSON.stringify(first));second.id='B2';second.narration_range=[cut,Buffer.byteLength(f.scene.voice)];second.layers.narrative_visual=hidden();second.layers.story_text={decision:'use',reason:'Chữ cố chen vào scene.',entity_ids:['txt']};
 f.planned.visual_coverage.beats=[first,second];
 assert.ok(codes(f).includes('COVERAGE_STORY_FOCUS_CONFLICT'));
});
