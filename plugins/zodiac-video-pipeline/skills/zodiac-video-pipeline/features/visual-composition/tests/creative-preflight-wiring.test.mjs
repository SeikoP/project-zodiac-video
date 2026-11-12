import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProgressivePreflight} from '../validate-phase02-progressive-preflight.mjs';

const svg='<svg viewBox="0 0 320 320"><metadata>style=zodiac-paper-doodle-meme-v4;handmade=human-stroke-v2</metadata><path d="M1 1 Q4 20 30 20" stroke="#2F3C44" stroke-width="5"/><path d="M2 2 Q6 30 40 40" stroke="#2F3C44" stroke-width="5"/></svg>';
const direction={
 id:'NV1',beat_ids:['B1'],evidence_refs:['E1'],
 trait_basis:'A supported Zodiac trait creates pressure around one decision.',
 story_point:'Keeping both options alive makes the decision harder.',
 viewer_read:'The character makes the choice heavier by refusing to release either option.',
 visible_subject:'Character between two option cards',
 visible_action:'The character repeatedly swaps the option cards between hands without putting either down.',
 visual_idea:'Two option cards remain visible while the character keeps changing hands and delaying release.',
 concept_fit:'The image directly advances the chosen episode premise.',
 centrality_reason:'The choice conflict is the central semantic turn.',
 why_visual_not_text:'The repeated hand motion communicates indecision better than a short phrase.',
 tone_fit:'Dry comic escalation keeps the scene readable.'
};
const fixture=()=>({
 intent:{taxonomy_version:'narrative_visual@1',scene_plan:{scenes:[{id:'S01',purpose:'Introduce pressure',beats:['B1']}],single_scene_rationale:'One focused beat',continuous_visual_logic:'One setup'},scenes:[{id:'S01',director_beats:[{beat_id:'B1',voice_anchor:'carry the cost',semantic_purpose:'setup',supported_motion_or_state:'hold'}],art_direction:{narrative_brief:{format:'zodiac-narrative-brief@2',phase1_visual_id:'NV1',story_point:direction.story_point,viewer_read:direction.viewer_read,anchor_phrase:'carry the cost',state_changes:[{from:'both held',to:'one released',anchor_phrase:'carry the cost'}]}},entities:[{id:'meaning',kind:'narrative_visual',states:{visible:{asset:'a',visible:true}}}],events:[]}],assets:{a:{path:'assets/a.svg',category:'narrative_visual',lineage:{mode:'authored'},creative_origin:{mode:'phase1_directed',phase1_visual_id:'NV1',scene_id:'S01',anchor_phrase:'carry the cost'}}}},
 production:{scenes:[{id:'S01',voice:'I carry the cost',events:[]}]},phase1Visuals:[direction],
 motionRegistry:{motions:{}},designToken:{id:'zodiac-paper-doodle-meme-v4',handmade_profile:'human-stroke-v2',stroke_width_range:[4,9],colors:['#2F3C44']},readAsset:async()=>svg
});
test('progressive preflight rejects Narrative Visual without Phase-1 provenance',async()=>{const f=fixture();f.intent.assets.a.creative_origin={mode:'scene_authored',scene_id:'S01',anchor_phrase:'carry the cost'};const v=await validateProgressivePreflight(f);assert.ok(v.issues.some(x=>x.code==='CREATIVE_PHASE1_DIRECTION_REQUIRED'));assert.equal(v.status,'BLOCKED');});
test('progressive preflight accepts concrete Phase-1-directed execution',async()=>{const v=await validateProgressivePreflight(fixture());assert.ok(!v.issues.some(x=>x.code.startsWith('CREATIVE_')));});
