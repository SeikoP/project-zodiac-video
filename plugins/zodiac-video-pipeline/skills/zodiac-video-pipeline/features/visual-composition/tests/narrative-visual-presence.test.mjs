import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {validateNarrativeVisualPresence} from '../validate-narrative-visual-presence.mjs';
import {validateComposition,compositionHash} from '../phase02-composition-core.mjs';
import {isStoryFacingObject} from '../validate-semantic-asset-fit.mjs';

const svg='<svg viewBox="0 0 520 400"><metadata>style=zodiac-paper-doodle-meme-v4;handmade=human-stroke-v2</metadata><path d="M30 40 Q150 10 210 90" fill="none" stroke="#2F3C44" stroke-width="7"/><path d="M240 180 Q330 80 425 150" fill="none" stroke="#8EC0B9" stroke-width="6"/></svg>';
const direction={id:'NV1',beat_ids:['B1'],evidence_refs:['E1'],trait_basis:'A supported trait creates hesitation around one choice.',story_point:'Keeping both choices alive makes the decision harder.',viewer_read:'The character keeps both options and creates their own pressure.',visible_subject:'Character holding two option cards',visible_action:'The character changes hands repeatedly without releasing either card.',visual_idea:'Two option cards remain visible while the character keeps swapping hands.',concept_fit:'The action externalizes the episode premise.',centrality_reason:'The choice conflict is the central turn.',why_visual_not_text:'The repeated action reads faster than a phrase.',tone_fit:'Dry comic escalation keeps the tone specific.'};

async function fixture({withDirection=true,withStoryText=false}={}){
 const root=await mkdtemp(path.join(os.tmpdir(),'narrative-presence-'));
 await mkdir(path.join(root,'.authoring'),{recursive:true});await mkdir(path.join(root,'assets'),{recursive:true});
 const voice='A small clue becomes a question.';
 await writeFile(path.join(root,'narration.txt'),voice);
 await writeFile(path.join(root,'.authoring/pipeline-state.json'),JSON.stringify({run_mode:'fresh'}));
 await writeFile(path.join(root,'.authoring/narrative-plan.json'),JSON.stringify({version:'2.0',narrative_visuals:withDirection?[direction]:[]}));
 const event={id:'N1',target:'NV',state_before:'hidden',state_after:'shown',trigger:{type:'voice_anchor',text:'question'}};
 const assets=withDirection?{A:{category:'narrative_visual',path:'assets/clue.svg',creative_origin:{mode:'phase1_directed',phase1_visual_id:'NV1',scene_id:'S01',anchor_phrase:'question'}}}:{};
 const entities=withDirection?[{id:'NV',kind:'narrative_visual',initial_state:'hidden',states:{hidden:{visible:false},shown:{visible:true,asset:'A',transform:{x:350,y:300,width:350,height:230}}}}]:[];
 if(withStoryText)entities.push({id:'TXT',kind:'object',visual_role:'overlay',initial_state:'hidden',states:{hidden:{visible:false}},story_text:{purpose:'annotation',reason:'text',states:{},styles:{}}});
 const intent={taxonomy_version:'narrative_visual@1',narrative_visual_decision:{mode:withDirection?'required':'omitted',reason:withDirection?'Phase 1 selected one concrete visual.':'Phase 1 selected no Narrative Visual.'},video:{width:1080,height:1920},assets,scenes:[{id:'S01',narration_range:[0,Buffer.byteLength(voice)],director_beats:[{beat_id:'B1'}],events:withDirection?[event]:[],layout_contract:{caption_safe_zone:{x:100,y:1450,width:880,height:360}},entities,art_direction:{...(withDirection?{narrative_brief:{format:'zodiac-narrative-brief@2',phase1_visual_id:'NV1',story_point:direction.story_point,viewer_read:direction.viewer_read,anchor_phrase:'question',state_changes:[{from:'hidden',to:'shown',event_id:'N1',anchor_phrase:'question'}]}}:{}),visual_coverage:{beats:[{layers:{narrative_visual:withDirection?{decision:'use',reason:'Central story point is clearer as action.',entity_ids:['NV']}:{decision:'omit',reason:'No Phase-1 direction.'},story_text:withStoryText?{decision:'use',reason:'Text attempts same focus.',entity_ids:['TXT']}:{decision:'omit',reason:'No Story Text.'}}}]}}}]};
 if(withDirection)await writeFile(path.join(root,'assets/clue.svg'),svg);
 await writeFile(path.join(root,'.authoring/visual-intent.json'),JSON.stringify(intent));
 return {root,intent};
}

test('no Phase-1 direction means Narrative Visual omission passes',async()=>{const {root}=await fixture({withDirection:false});try{assert.equal((await validateNarrativeVisualPresence(root)).status,'PASS');}finally{await rm(root,{recursive:true,force:true});}});
test('Phase-1 direction requires real SVG, lineage and anchored coverage',async()=>{const {root,intent}=await fixture();try{assert.equal((await validateNarrativeVisualPresence(root)).status,'PASS');intent.scenes[0].entities=[];await writeFile(path.join(root,'.authoring/visual-intent.json'),JSON.stringify(intent));const result=await validateNarrativeVisualPresence(root);assert(result.issues.some(i=>i.code==='NARRATIVE_VISUAL_REQUIRED_BUT_ABSENT'));}finally{await rm(root,{recursive:true,force:true});}});
test('Narrative Visual and Story Text block in one scene',async()=>{const {root}=await fixture({withStoryText:true});try{const result=await validateNarrativeVisualPresence(root);assert(result.issues.some(i=>i.code==='STORY_FOCUS_LAYER_CONFLICT'));}finally{await rm(root,{recursive:true,force:true});}});
test('missing authored SVG fails closed',async()=>{const {root}=await fixture();try{await rm(path.join(root,'assets/clue.svg'));const result=await validateNarrativeVisualPresence(root);assert(result.issues.some(i=>i.code==='NARRATIVE_VISUAL_ASSET_MISSING'));}finally{await rm(root,{recursive:true,force:true});}});
test('projected Job5 story_object role remains valid transport',()=>{const tok={id:'test-token'};const state={transform:{x:280,y:320,width:320,height:280},visible:true,layer:35};const entity={id:'NV',kind:'object',visual_role:'story_object',initial_state:'visible',states:{visible:state}};const layout={canvas:{width:1080,height:1920},caption_safe_zone:{x:100,y:1450,width:880,height:360}};const scene={id:'S01',voice:'Question',entities:[entity],events:[],layout_contract:layout,occlusion_relations:[],spatial_bindings:[]};const plan={design_token_sha256:compositionHash(tok),scenes:[{id:'S01',voice:'Question',components:[{id:'NV',visual_role:'story_object',reason:'Transported Narrative Visual',voice_anchor:'Question',initial_state:'visible',states:{visible:state}}],layout_contract:layout,occlusion_relations:[],spatial_bindings:[]}]};assert.equal(validateComposition({scenes:[scene]},plan,tok).status,'PASS');});
test('canvas scene accent is not a story-facing prop',()=>assert.equal(isStoryFacingObject({}, {id:'A_CAFE_S01',kind:'object',visual_role:'background',role:'scene_accent',states:{visible:{asset:'ACCENT'}}},{}),false));
