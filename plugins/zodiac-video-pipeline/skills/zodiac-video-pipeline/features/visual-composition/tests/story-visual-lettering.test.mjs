import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStoryVisualLettering} from '../validate-story-visual-lettering.mjs';
import {validateVisualCoverage} from '../validate-visual-coverage.mjs';
import {createHash} from 'node:crypto';

const fixture=()=>({intent:{assets:{WORDS:{category:'story_visual'}},scenes:[{id:'S01',entities:[{id:'words',kind:'story_visual',visual_role:'story_visual',initial_state:'hidden',states:{hidden:{visible:false,asset:'WORDS'},shown:{visible:true,asset:'WORDS'}},lettering:{purpose:'contrast',reason:'Expose the contradiction in a short statement.',states:{shown:'ĐỂ MAI'}}}],events:[{id:'enter',target:'words',state_after:'shown',trigger:{type:'voice_anchor',text:'Mai nhé.'}},{id:'exit',target:'words',state_after:'hidden',trigger:{type:'voice_anchor',text:'Không.'}}]}]},production:{scenes:[{id:'S01',voice:'Mai nhé. Không.'}]}});
test('lettering belongs to its story visual independently of memes and must reveal/release at narration anchors',()=>{
 const {intent,production}=fixture();assert.deepEqual(validateStoryVisualLettering(intent,production),[]);
 intent.scenes[0].events.pop();assert.ok(validateStoryVisualLettering(intent,production).some(x=>x.code==='STORY_VISUAL_LETTERING_RELEASE_REQUIRED'));
 intent.scenes[0].entities[0].lettering.hold_to_scene_end_reason='This is the final payoff.';assert.deepEqual(validateStoryVisualLettering(intent,production),[]);
 intent.scenes[0].events[0].trigger.text='Missing sentence';assert.ok(validateStoryVisualLettering(intent,production).some(x=>x.code==='STORY_VISUAL_LETTERING_ANCHOR_INVALID'));
});
test('lettering uses the same story visual coverage entry',()=>{
 const {intent,production}=fixture(),scene={...intent.scenes[0],voice:production.scenes[0].voice};
 const plan={components:[{id:'words',visual_role:'story_visual'}],visual_coverage:{format:'zodiac-visual-coverage@1',layers_version:'story_visual@1',narration_sha256:createHash('sha256').update(scene.voice).digest('hex'),beats:[{id:'b',goal:'Show then reject postponement',narration_range:[0,Buffer.byteLength(scene.voice)],event_ids:['enter','exit'],layers:{story_visual:{decision:'use',reason:'Contradict the proposal',entity_ids:['words']}}}]}};
 assert.deepEqual(validateVisualCoverage(scene,plan,{deriveEmptyLayers:true}).filter(x=>x.layer!=='caption'),[]);
 delete plan.visual_coverage.beats[0].layers.story_visual;
 assert.ok(validateVisualCoverage(scene,plan,{deriveEmptyLayers:true}).some(x=>x.code==='COVERAGE_VISIBLE_ENTITY_UNDECLARED'));
});
test('different phrases cannot share a path across states or scenes',()=>{
 const {intent,production}=fixture(),entity=intent.scenes[0].entities[0];
 entity.states.payoff={asset:'WORDS',visible:true};entity.lettering.states.payoff='ĐÃ LÀM';
 assert.ok(validateStoryVisualLettering(intent,production).some(x=>x.code==='STORY_VISUAL_LETTERING_ASSET_TEXT_CONFLICT'));
 entity.states.payoff.asset='OTHER';intent.assets.WORDS.path='assets/words.svg';intent.assets.OTHER={category:'story_visual',path:'assets/words.svg'};
 assert.ok(validateStoryVisualLettering(intent,production).some(x=>x.code==='STORY_VISUAL_LETTERING_ASSET_TEXT_CONFLICT'));
 delete entity.states.payoff;delete entity.lettering.states.payoff;
 const second=structuredClone(intent.scenes[0]);second.id='S02';second.entities[0].lettering.states.shown='ĐÃ LÀM';intent.scenes.push(second);production.scenes.push({...production.scenes[0],id:'S02'});
 assert.ok(validateStoryVisualLettering(intent,production).some(x=>x.code==='STORY_VISUAL_LETTERING_ASSET_TEXT_CONFLICT'));
});
test('lettering treatments are explicit and cannot overwrite a differently styled state',()=>{
 const {intent,production}=fixture(),entity=intent.scenes[0].entities[0];
 entity.lettering.styles={shown:'stamp'};assert.deepEqual(validateStoryVisualLettering(intent,production),[]);
 entity.states.second={...entity.states.shown};entity.lettering.states.second=entity.lettering.states.shown;
 entity.lettering.styles.second='note';assert.ok(validateStoryVisualLettering(intent,production).some(x=>x.code==='STORY_VISUAL_LETTERING_ASSET_TEXT_CONFLICT'));
 entity.lettering.styles.shown='neon';assert.ok(validateStoryVisualLettering(intent,production).some(x=>x.code==='STORY_VISUAL_LETTERING_STYLE_INVALID'));
});
test('compact speech, thought, burst and whisper lettering retain reveal/release validation',()=>{
 for(const style of ['bubble','thought','burst','whisper','tag','ribbon','underline','sfx']){
  const {intent,production}=fixture();
  intent.scenes[0].entities[0].lettering.styles={shown:style};
  assert.deepEqual(validateStoryVisualLettering(intent,production),[],style);
  intent.scenes[0].events.pop();
  assert.ok(validateStoryVisualLettering(intent,production).some(x=>x.code==='STORY_VISUAL_LETTERING_RELEASE_REQUIRED'),style);
 }
});

test('separate lettering objects and role relabels cannot bypass the unified entity',()=>{
 for(const [kind,visual_role] of [['object','overlay'],['object','story_visual'],['story_visual','overlay']]){
  const {intent,production}=fixture();Object.assign(intent.scenes[0].entities[0],{kind,visual_role});
  assert.ok(validateStoryVisualLettering(intent,production).some(x=>x.code==='STORY_VISUAL_LETTERING_ROLE_INVALID'));
 }
});
test('visible drawing states do not need lettering, but authored words must name a real visible state',()=>{
 const {intent,production}=fixture(),entity=intent.scenes[0].entities[0];
 entity.states.drawing={visible:true,asset:'DRAWING'};intent.assets.DRAWING={category:'story_visual'};
 assert.deepEqual(validateStoryVisualLettering(intent,production),[]);
 entity.lettering.states.typo='UNBOUND';
 assert.ok(validateStoryVisualLettering(intent,production).some(x=>x.code==='STORY_VISUAL_LETTERING_STATE_INVALID'));
});
test('separate lettering coverage is rejected even when its entity is relabelled',()=>{
 const {intent,production}=fixture(),scene={...intent.scenes[0],voice:production.scenes[0].voice};
 const plan={components:[{id:'words',visual_role:'story_visual'}],visual_coverage:{format:'zodiac-visual-coverage@1',layers_version:'story_visual@1',narration_sha256:createHash('sha256').update(scene.voice).digest('hex'),beats:[{id:'b',goal:'Read the image',narration_range:[0,Buffer.byteLength(scene.voice)],event_ids:['enter','exit'],layers:{story_visual:{decision:'use',reason:'The image conveys the point',entity_ids:['words']},lettering:{decision:'omit',reason:'legacy layer'}}}]}};
 assert.ok(validateVisualCoverage(scene,plan,{deriveEmptyLayers:true}).some(x=>x.code==='COVERAGE_LAYER_UNKNOWN'&&x.layer==='lettering'));
});
