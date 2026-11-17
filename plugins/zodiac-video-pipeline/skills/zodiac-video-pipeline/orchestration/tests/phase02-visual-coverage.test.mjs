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
 const planned={components:[{id:'actor',visual_role:'character'}],visual_coverage:{format:'zodiac-visual-coverage@1',layers_version:'story_visual@1',narration_sha256:createHash('sha256').update(voice).digest('hex'),beats:[{id:'B1',goal:'Diễn ý chính.',narration_range:[0,Buffer.byteLength(voice)],event_ids:[],layers}]}};
 return {scene,planned};
}
const codes=(f)=>validateVisualCoverage(f.scene,f.planned,{required:true}).map(x=>x.code);

test('current coverage has one Hình kể chuyện layer and no Story Object layer',()=>{
 assert.deepEqual(coverageLayers,['actors','scene_accent','story_visual','props','support','caption']);
 assert.equal(coverageLayers.includes('story_object'),false);
});
test('current minimal coverage passes without Hình kể chuyện quota',()=>assert.deepEqual(codes(fixture()),[]));
test('missing current layer decision blocks',()=>{const f=fixture();delete f.planned.visual_coverage.beats[0].layers.story_visual;assert.ok(codes(f).includes('COVERAGE_LAYER_DECISION_MISSING'));});
test('stale narration hash blocks',()=>{const f=fixture();f.planned.visual_coverage.narration_sha256='stale';assert.ok(codes(f).includes('COVERAGE_NARRATION_STALE'));});
test('legacy independent lettering coverage is rejected',()=>{
 const f=fixture();
 f.planned.visual_coverage.beats[0].layers.lettering={decision:'use',reason:'Legacy standalone lettering lane.',entity_ids:['actor']};
 assert.ok(codes(f).includes('COVERAGE_LAYER_UNKNOWN'));
});

test('outlined lettering may live inside the same Story Visual without a second coverage lane',()=>{
 const f=fixture();
 const sv={id:'sv',kind:'story_visual',visual_role:'story_visual',initial_state:'on',states:{on:{visible:true}},lettering:{states:{on:'ĐỂ TÔI'}}};
 f.scene.entities.push(sv);
 f.planned.components.push({id:'sv',narrative_role:'story_visual',visual_role:'story_visual'});
 f.planned.visual_coverage.beats[0].layers.story_visual={decision:'use',reason:'One Story Visual owns drawing and wording.',entity_ids:['sv']};
 assert.deepEqual(codes(f),[]);
});
