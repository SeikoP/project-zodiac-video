import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCreativeProvenance} from '../validate-creative-asset-provenance.mjs';

const svg='<svg viewBox="0 0 320 320"><path d="M1 1 Q1 30 50 50"/><path d="M2 2 Q2 40 60 60"/></svg>';
const direction={
 id:'NV1',beat_ids:['B1'],evidence_refs:['E1'],
 trait_basis:'A supported Zodiac trait creates selective pressure around one decision.',
 story_point:'Keeping both options alive makes the decision harder.',
 viewer_read:'The character is making the choice heavier by refusing to release either option.',
 visible_subject:'Character between two option cards',
 visible_action:'The character repeatedly swaps the two cards between hands without putting either down.',
 visual_idea:'Two option cards stay in frame while the character keeps changing hands and delaying the release of one card.',
 concept_fit:'The action externalizes the episode premise instead of adding a generic sign icon.',
 centrality_reason:'The choice conflict is the central semantic turn of this scene.',
 why_visual_not_text:'The repeated hand change communicates indecision more directly than a short phrase.',
 tone_fit:'Dry comic escalation keeps the scene specific and readable.',
 payoff_image:'One card is finally placed down and the other is pushed away.'
};
const directed=()=>({
 taxonomy_version:'narrative_visual@1',
 assets:{a:{path:'assets/a.svg',category:'narrative_visual',creative_origin:{mode:'phase1_directed',phase1_visual_id:'NV1',scene_id:'S01',anchor_phrase:'carry the cost'}}},
 scenes:[{id:'S01',voice:'I carry the cost',director_beats:[{beat_id:'B1'}],art_direction:{narrative_brief:{format:'zodiac-narrative-brief@2',phase1_visual_id:'NV1',story_point:direction.story_point,viewer_read:direction.viewer_read,anchor_phrase:'carry the cost',state_changes:[{from:'both cards held',to:'one card released',anchor_phrase:'carry the cost'}]}},entities:[{id:'visual1',kind:'narrative_visual',states:{visible:{asset:'a',visible:true}}}]}]
});

test('accepts one Phase-1-directed Narrative Visual execution',()=>assert.equal(validateCreativeProvenance(directed(),{a:svg},[direction]).status,'PASS'));
test('blocks an authored Narrative Visual without Phase-1 lineage',()=>{const x=directed();x.assets.a.creative_origin={mode:'scene_authored',scene_id:'S01',anchor_phrase:'carry the cost'};assert.match(JSON.stringify(validateCreativeProvenance(x,{a:svg},[direction]).issues),/CREATIVE_PHASE1_DIRECTION_REQUIRED/);});
test('blocks Phase-2 meaning drift from Phase 1',()=>{const x=directed();x.scenes[0].art_direction.narrative_brief.viewer_read='A different visual meaning entirely';assert.match(JSON.stringify(validateCreativeProvenance(x,{a:svg},[direction]).issues),/CREATIVE_PHASE1_MEANING_DRIFT/);});
test('blocks missing narration anchor',()=>{const x=directed();x.assets.a.creative_origin.anchor_phrase='absent phrase';assert.match(JSON.stringify(validateCreativeProvenance(x,{a:svg},[direction]).issues),/CREATIVE_VOICE_ANCHOR_REQUIRED/);});
test('blocks beat mismatch',()=>{const x=directed();x.scenes[0].director_beats=[{beat_id:'OTHER'}];assert.match(JSON.stringify(validateCreativeProvenance(x,{a:svg},[direction]).issues),/CREATIVE_PHASE1_BEAT_MISMATCH/);});
test('blocks identical art reused across scenes without reason',()=>{const x=directed();x.assets.b={path:'assets/b.svg',category:'narrative_visual',creative_origin:{...x.assets.a.creative_origin,scene_id:'S02'}};x.scenes.push({...x.scenes[0],id:'S02',entities:[{id:'visual2',kind:'narrative_visual',states:{visible:{asset:'b',visible:true}}}]});assert.match(JSON.stringify(validateCreativeProvenance(x,{a:svg,b:svg},[direction]).issues),/CREATIVE_STOCK_REUSE_REQUIRES_REVIEW/);});
test('rejects unsafe embedded script',()=>{const result=validateCreativeProvenance(directed(),{a:svg.replace('</svg>','<script>evil()</script></svg>')},[direction]);assert.match(JSON.stringify(result.issues),/CREATIVE_SVG_UNSAFE/);});
test('non Narrative Visual taxonomy remains not applicable',()=>assert.equal(validateCreativeProvenance({taxonomy_version:'other'},{}).status,'NOT_APPLICABLE'));
