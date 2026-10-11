import test from 'node:test';import assert from 'node:assert/strict';
import {compileEpisodeWriterBrief} from '../episode-writer-brief.mjs';import {compileWriterBrief,assertWriterBriefLineage} from '../compile-writer-brief.mjs';import {compileEpisodeEvidenceView} from '../episode-evidence.mjs';import {scope,ledger,plan,candidates,research} from './helpers/episode-fixture.mjs';
export const input=()=>({episodeScope:scope(),researchScope:research(),selectedCandidate:candidates().candidates[0],narrativePlan:plan(),evidenceBrief:compileEpisodeEvidenceView(ledger(),scope()),viral:{mechanics:[{id:'V1',writer_effect:'Đổi cách nhìn từ biểu hiện sang động cơ'}]},referenceMechanics:{reference_present:false},authoredBriefExtras:{rhythm_direction:'Nhanh → chậm → mở',forbidden_claims:[]}});
test('episode writer brief carries selected lenses only, without a fabricated primary sign',()=>{
 const x=input(),r=compileEpisodeWriterBrief(x);assert.equal(r.brief.format,'zodiac-episode-writer-brief@1');assert.equal(r.brief.member_lenses.length,3);assert.equal(r.brief.sign,undefined);assert.ok(r.brief.selected_evidence.every(e=>!e.member_ids.includes('virgo')));assert.equal(r.receipt.not_an_approval,true);assert.ok(r.receipt.output_bytes<=10000);
});
test('public compiler and lineage dispatch support episode input without weakening old path',()=>{
 const x=input(),r=compileWriterBrief(x);assert.equal(r.brief.episode_scope.episode_format,'element_group');assertWriterBriefLineage(r.brief,x,r.receipt);
 x.authoredBriefExtras.rhythm_direction='Changed';assert.throws(()=>assertWriterBriefLineage(r.brief,x,r.receipt),/SOURCE_LINEAGE_DRIFT/);
});
test('scope, selected identity, budget and forbidden context mutations block brief generation',()=>{
 for(const mutate of [x=>x.episodeScope.member_ids.reverse(),x=>x.selectedCandidate.member_lenses[0].identity_mechanism='Changed',x=>x.authoredBriefExtras.raw_srt='forbidden',x=>x.authoredBriefExtras.rhythm_direction='x'.repeat(11000)]){const x=input();mutate(x);assert.throws(()=>compileEpisodeWriterBrief(x),/EPISODE|WRITER_BRIEF/);}
});
