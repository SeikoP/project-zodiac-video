import test from 'node:test';import assert from 'node:assert/strict';
import {validateEpisodeConcept} from '../validate-episode-concept.mjs';import {compileEpisodeEvidenceView} from '../episode-evidence.mjs';import {scope,ledger,plan,candidates} from './helpers/episode-fixture.mjs';
const input=()=>({scope:scope(),candidates:candidates(),narrativePlan:plan(),evidenceView:compileEpisodeEvidenceView(ledger(),scope())});
test('three distinct premises and grounded per-member lenses are structurally valid',()=>assert.equal(validateEpisodeConcept(input()).status,'VALID'));
test('missing member lens, unresolved refs, duplicated premise and changed scope block',()=>{
 for(const mutate of [x=>x.candidates.candidates[0].member_lenses.pop(),x=>x.candidates.candidates[0].member_lenses[0].evidence_refs=['E3','E4'],x=>x.candidates.candidates[1].premise=x.candidates.candidates[0].premise,x=>x.narrativePlan.episode_scope.member_ids.reverse(),x=>x.narrativePlan.member_lenses[0].identity_mechanism='Changed']){
  const x=input();mutate(x);assert.equal(validateEpisodeConcept(x).status,'BLOCKED');
 }
});
test('top requires ordering counterfactual rather than an asserted objective score',()=>{
 const x=input();x.scope.episode_format='ranked_shortlist';delete x.scope.group_element;x.narrativePlan.episode_scope=x.scope;
 assert.equal(validateEpisodeConcept(x).status,'BLOCKED');
});
