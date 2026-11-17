import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveDepthPlan} from '../../features/visual-composition/derive-depth-composition-plan.mjs';
import catalog from '../../references/depth-catalog.json' with {type:'json'};

const scene=(id,mode,purpose,palette='warm-paper',sparse_reason=null)=>({
 id,
 environment:{mode:'canvas',background_palette_id:palette},
 experience_profile:{story_mode:mode,...(sparse_reason?{sparse_reason}:{})},
 director_beats:[{beat_id:id+'_B1',semantic_purpose:purpose}]
});

test('derives abstract depth from story mode without literal scene set',()=>{
 const plan=deriveDepthPlan({scenes:[
  scene('S01','relationship','setup','warm-paper'),
  scene('S02','relationship','contrast','mint-air'),
  scene('S05','reflection','realization','sand-coral','Keep deliberate negative space.'),
  scene('S06','relationship','payoff','blush-paper')
 ]},catalog);
 assert.equal(plan.format,'zodiac-depth-composition-plan@1');
 assert.equal(plan.source,'derived-from-visual-intent');
 assert.deepEqual(plan.scenes.map(s=>[s.scene_id,s.profile,s.layers]),[
  ['S01','relationship-space',['rear','front']],
  ['S02','split-thought',['rear','divider','front']],
  ['S05','split-thought',['rear']],
  ['S06','spotlight-payoff',['rear','front']]
 ]);
 assert.equal(plan.scenes[1].palette,'cool-reflective');
 assert.equal(plan.scenes[3].palette,'warm-emotional');
});

test('literal legacy scene set is not reintroduced by depth derivation',()=>{
 const s=scene('S01','relationship','setup');s.environment.scene_set_id='legacy-room';
 const plan=deriveDepthPlan({scenes:[s]},catalog);
 assert.deepEqual(plan.scenes,[]);
});
