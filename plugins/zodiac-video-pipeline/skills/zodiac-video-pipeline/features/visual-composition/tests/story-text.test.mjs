import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStoryText} from '../validate-story-text.mjs';
import {validateVisualCoverage} from '../validate-visual-coverage.mjs';
import {createHash} from 'node:crypto';

const fixture=()=>({intent:{assets:{WORDS:{category:'overlay'}},scenes:[{id:'S01',entities:[{id:'words',kind:'object',visual_role:'overlay',initial_state:'hidden',states:{hidden:{visible:false,asset:'WORDS'},shown:{visible:true,asset:'WORDS'}},story_text:{purpose:'contrast',reason:'Expose the contradiction in a short statement.',states:{shown:'ĐỂ MAI'}}}],events:[{id:'enter',target:'words',state_after:'shown',trigger:{type:'voice_anchor',text:'Mai nhé.'}},{id:'exit',target:'words',state_after:'hidden',trigger:{type:'voice_anchor',text:'Không.'}}]}]},production:{scenes:[{id:'S01',voice:'Mai nhé. Không.'}]}});
test('story text works independently of memes and must reveal/release at narration anchors',()=>{
 const {intent,production}=fixture();assert.deepEqual(validateStoryText(intent,production),[]);
 intent.scenes[0].events.pop();assert.ok(validateStoryText(intent,production).some(x=>x.code==='STORY_TEXT_RELEASE_REQUIRED'));
 intent.scenes[0].entities[0].story_text.hold_to_scene_end_reason='This is the final payoff.';assert.deepEqual(validateStoryText(intent,production),[]);
 intent.scenes[0].events[0].trigger.text='Missing sentence';assert.ok(validateStoryText(intent,production).some(x=>x.code==='STORY_TEXT_ANCHOR_INVALID'));
});
test('story lettering is a declared coverage layer, never a physical prop',()=>{
 const {intent,production}=fixture(),scene={...intent.scenes[0],voice:production.scenes[0].voice};
 const plan={components:[{id:'words',visual_role:'overlay'}],visual_coverage:{format:'zodiac-visual-coverage@1',layers_version:'narrative_visual@1',narration_sha256:createHash('sha256').update(scene.voice).digest('hex'),beats:[{id:'b',goal:'Show then reject postponement',narration_range:[0,Buffer.byteLength(scene.voice)],event_ids:['enter','exit'],layers:{story_text:{decision:'use',reason:'Contradict the proposal',entity_ids:['words']}}}]}};
 assert.deepEqual(validateVisualCoverage(scene,plan,{deriveEmptyLayers:true}).filter(x=>x.layer!=='caption'),[]);
 delete plan.visual_coverage.beats[0].layers.story_text;
 assert.ok(validateVisualCoverage(scene,plan,{deriveEmptyLayers:true}).some(x=>x.code==='COVERAGE_VISIBLE_ENTITY_UNDECLARED'));
});
test('different phrases cannot share a path across states or scenes',()=>{
 const {intent,production}=fixture(),entity=intent.scenes[0].entities[0];
 entity.states.payoff={asset:'WORDS',visible:true};entity.story_text.states.payoff='ĐÃ LÀM';
 assert.ok(validateStoryText(intent,production).some(x=>x.code==='STORY_TEXT_ASSET_TEXT_CONFLICT'));
 entity.states.payoff.asset='OTHER';intent.assets.WORDS.path='assets/words.svg';intent.assets.OTHER={category:'overlay',path:'assets/words.svg'};
 assert.ok(validateStoryText(intent,production).some(x=>x.code==='STORY_TEXT_ASSET_TEXT_CONFLICT'));
 delete entity.states.payoff;delete entity.story_text.states.payoff;
 const second=structuredClone(intent.scenes[0]);second.id='S02';second.entities[0].story_text.states.shown='ĐÃ LÀM';intent.scenes.push(second);production.scenes.push({...production.scenes[0],id:'S02'});
 assert.ok(validateStoryText(intent,production).some(x=>x.code==='STORY_TEXT_ASSET_TEXT_CONFLICT'));
});
test('lettering treatments are explicit and cannot overwrite a differently styled state',()=>{
 const {intent,production}=fixture(),entity=intent.scenes[0].entities[0];
 entity.story_text.styles={shown:'stamp'};assert.deepEqual(validateStoryText(intent,production),[]);
 entity.states.second={...entity.states.shown};entity.story_text.states.second=entity.story_text.states.shown;
 entity.story_text.styles.second='note';assert.ok(validateStoryText(intent,production).some(x=>x.code==='STORY_TEXT_ASSET_TEXT_CONFLICT'));
 entity.story_text.styles.shown='neon';assert.ok(validateStoryText(intent,production).some(x=>x.code==='STORY_TEXT_STYLE_INVALID'));
});
test('compact speech, thought, burst and whisper lettering retain reveal/release validation',()=>{
 for(const style of ['bubble','thought','burst','whisper','tag','ribbon','underline','sfx']){
  const {intent,production}=fixture();
  intent.scenes[0].entities[0].story_text.styles={shown:style};
  assert.deepEqual(validateStoryText(intent,production),[],style);
  intent.scenes[0].events.pop();
  assert.ok(validateStoryText(intent,production).some(x=>x.code==='STORY_TEXT_RELEASE_REQUIRED'),style);
 }
});
