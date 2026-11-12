import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCreativeProvenance} from '../validate-creative-asset-provenance.mjs';

const svg='<svg viewBox="0 0 320 320"><path d="M1 1 Q1 30 50 50"/><path d="M2 2 Q2 40 60 60"/></svg>';
const phase1=[{
 id:'NV1',
 beat_ids:['B1'],
 evidence_refs:['E1'],
 trait_basis:'Selective attention shapes what gets noticed.',
 story_tension:'The promise becomes heavier the longer it is kept.',
 claim:'The cost of keeping a difficult promise',
 concept_fit:'The image externalizes the episode premise instead of naming a generic trait.',
 concept_candidates:{literal:'A person carrying too many unfinished tasks',metaphor:'A rope tightening around a difficult promise',exaggeration:'A tower of obligations pressing on one person'},
 selected_concept:'metaphor',
 selection_reason:'The tightening rope can progress visibly through the beat.',
 humor_mechanism:'Deadpan escalation turns an invisible burden into an absurdly literal restraint.',
 payoff_image:'The rope loosens only when the character finally chooses what to release.'
}];
const directed=()=>({
 taxonomy_version:'narrative_visual@1',
 assets:{a:{path:'assets/a.svg',creative_origin:{mode:'phase1_directed',phase1_visual_id:'NV1',scene_id:'S01',anchor_phrase:'carry the cost'}}},
 scenes:[{id:'S01',voice:'I carry the cost',director_beats:[{beat_id:'B1'}],art_direction:{narrative_brief:{claim:'The cost of keeping a difficult promise'}},entities:[{id:'visual1',kind:'narrative_visual',states:{visible:{asset:'a',visible:true}}}]}]
});
const legacy=()=>({
 taxonomy_version:'narrative_visual@1',
 assets:{a:{path:'assets/a.svg',creative_origin:{mode:'scene_authored',scene_id:'S01',claim:'Someone carries the cost of a promise',anchor_phrase:'carry the cost',concept_candidates:{literal:'A woman holding too many cards',metaphor:'A rope tied around her choices',exaggeration:'A mountain of impossible promises'},selected_concept:'metaphor',selection_reason:'A rope tightens through a dramatic action'}}},
 scenes:[{id:'S01',voice:'I carry the cost',art_direction:{narrative_brief:{claim:'The cost of keeping a difficult promise'}},entities:[{id:'visual1',kind:'narrative_visual',states:{visible:{asset:'a',visible:true}}}]}]
});

test('accepts Phase-1-directed Narrative Visual execution',()=>assert.equal(validateCreativeProvenance(directed(),{a:svg},phase1).status,'PASS'));
test('blocks a fresh directed visual without Phase-1 lineage',()=>{const x=directed();x.assets.a.creative_origin={mode:'scene_authored',scene_id:'S01',anchor_phrase:'carry the cost'};assert.match(JSON.stringify(validateCreativeProvenance(x,{a:svg},phase1).issues),/CREATIVE_PHASE1_DIRECTION_REQUIRED/);});
test('blocks claim drift from Phase 1',()=>{const x=directed();x.scenes[0].art_direction.narrative_brief.claim='A different visual claim entirely';assert.match(JSON.stringify(validateCreativeProvenance(x,{a:svg},phase1).issues),/CREATIVE_PHASE1_CLAIM_DRIFT/);});
test('blocks directed visual when narration anchor is absent',()=>{const x=directed();x.assets.a.creative_origin.anchor_phrase='absent phrase';assert.match(JSON.stringify(validateCreativeProvenance(x,{a:svg},phase1).issues),/CREATIVE_VOICE_ANCHOR_REQUIRED/);});
test('blocks directed visual when selected Phase-1 beat is not in the scene',()=>{const x=directed();x.scenes[0].director_beats=[{beat_id:'OTHER'}];assert.match(JSON.stringify(validateCreativeProvenance(x,{a:svg},phase1).issues),/CREATIVE_PHASE1_BEAT_MISMATCH/);});
test('keeps older scene-authored workspaces compatible when no Phase-1 direction exists',()=>assert.equal(validateCreativeProvenance(legacy(),{a:svg},[]).status,'PASS'));
test('blocks identical illustration reused between scenes without reason',()=>{const x=directed();x.assets.b={path:'assets/b.svg',creative_origin:{...x.assets.a.creative_origin,scene_id:'S02'}};x.scenes.push({...x.scenes[0],id:'S02',entities:[{id:'visual2',kind:'narrative_visual',states:{visible:{asset:'b',visible:true}}}]});assert.match(JSON.stringify(validateCreativeProvenance(x,{a:svg,b:svg},phase1).issues),/CREATIVE_STOCK_REUSE_REQUIRES_REVIEW/);});
test('rejects unsafe embedded script',()=>{const result=validateCreativeProvenance(directed(),{a:svg.replace('</svg>','<script>evil()</script></svg>')},phase1);assert.match(JSON.stringify(result.issues),/CREATIVE_SVG_UNSAFE/);});
test('does not retroactively block compatibility-only runs',()=>assert.equal(validateCreativeProvenance({taxonomy_version:'legacy'},{}).status,'NOT_APPLICABLE'));
