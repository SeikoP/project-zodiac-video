import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {validateNarrativeVisualPresence} from '../validate-narrative-visual-presence.mjs';
import {validateComposition,compositionHash} from '../phase02-composition-core.mjs';
import {isStoryFacingObject} from '../validate-semantic-asset-fit.mjs';

const svg='<svg viewBox="0 0 520 400"><metadata>style=zodiac-paper-doodle-meme-v4;handmade=human-stroke-v2</metadata><path d="M30 40 Q150 10 210 90" fill="none" stroke="#2F3C44" stroke-width="7"/><path d="M240 180 Q330 80 425 150" fill="none" stroke="#8EC0B9" stroke-width="6"/></svg>';
async function fixture(){
 const root=await mkdtemp(path.join(os.tmpdir(),'narrative-presence-'));
 await mkdir(path.join(root,'.authoring'),{recursive:true});
 await mkdir(path.join(root,'assets'),{recursive:true});
 const voice='A small clue becomes a question.';
 await writeFile(path.join(root,'narration.txt'),voice);
 await writeFile(path.join(root,'.authoring/pipeline-state.json'),JSON.stringify({run_mode:'fresh'}));
 const event={id:'N1',target:'NV',state_before:'hidden',state_after:'shown',trigger:{type:'voice_anchor',text:'question'}};
 const intent={taxonomy_version:'narrative_visual@1',narrative_visual_decision:{mode:'required',reason:'Thought is explicit'},video:{width:1080,height:1920},assets:{A:{category:'narrative_visual',path:'assets/clue.svg'}},scenes:[{id:'S01',narration_range:[0,Buffer.byteLength(voice)],events:[event],layout_contract:{caption_safe_zone:{x:100,y:1450,width:880,height:360}},entities:[{id:'NV',kind:'narrative_visual',initial_state:'hidden',states:{hidden:{visible:false},shown:{visible:true,asset:'A',transform:{x:350,y:300,width:350,height:230}}}}],art_direction:{narrative_brief:{format:'zodiac-narrative-brief@1',claim:'Hidden question materializes',anchor_phrase:'question',state_changes:[{from:'hidden',to:'shown',event_id:'N1',anchor_phrase:'question'}]},visual_coverage:{beats:[{layers:{narrative_visual:{decision:'use',reason:'Internal question is visible',entity_ids:['NV']}}}]}}}]};
 await writeFile(path.join(root,'assets/clue.svg'),svg);
 await writeFile(path.join(root,'.authoring/visual-intent.json'),JSON.stringify(intent));
 return {root,intent};
}
test('required narrative presence must have real SVG and anchored coverage',async()=>{
 const {root,intent}=await fixture();
 try{
  assert.equal((await validateNarrativeVisualPresence(root)).status,'PASS');
  intent.scenes[0].entities=[];
  await writeFile(path.join(root,'.authoring/visual-intent.json'),JSON.stringify(intent));
  const result=await validateNarrativeVisualPresence(root);
  assert.equal(result.status,'BLOCKED');
  assert(result.issues.some(i=>i.code==='NARRATIVE_VISUAL_REQUIRED_BUT_ABSENT'));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('missing authored SVG fails closed',async()=>{
 const {root}=await fixture();
 try{await rm(path.join(root,'assets/clue.svg'));const result=await validateNarrativeVisualPresence(root);assert(result.issues.some(i=>i.code==='NARRATIVE_VISUAL_ASSET_MISSING'));}
 finally{await rm(root,{recursive:true,force:true});}
});
test('projected story_object visual role passes composition contract',()=>{
 const tok={id:'test-token'};
 const state={transform:{x:280,y:320,width:320,height:280},visible:true,layer:35};
 const entity={id:'NV',kind:'object',visual_role:'story_object',initial_state:'visible',states:{visible:state}};
 const layout={canvas:{width:1080,height:1920},caption_safe_zone:{x:100,y:1450,width:880,height:360}};
 const scene={id:'S01',voice:'Question',entities:[entity],events:[],layout_contract:layout,occlusion_relations:[],spatial_bindings:[]};
 const plan={design_token_sha256:compositionHash(tok),scenes:[{id:'S01',voice:'Question',components:[{id:'NV',visual_role:'story_object',reason:'Mental clue',voice_anchor:'Question',initial_state:'visible',states:{visible:state}}],layout_contract:layout,occlusion_relations:[],spatial_bindings:[]}]};
 assert.equal(validateComposition({scenes:[scene]},plan,tok).status,'PASS');
});
test('canvas scene accent is not a physical or story-facing prop',()=>{
 assert.equal(isStoryFacingObject({}, {id:'A_CAFE_S01',kind:'object',visual_role:'background',role:'scene_accent',states:{visible:{asset:'ACCENT'}}},{}),false);
});
