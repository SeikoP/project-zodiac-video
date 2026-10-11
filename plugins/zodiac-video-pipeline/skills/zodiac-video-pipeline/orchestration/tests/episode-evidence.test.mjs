import test from 'node:test';import assert from 'node:assert/strict';
import {compileEpisodeEvidenceView} from '../episode-evidence.mjs';
export const episode=()=>({format:'zodiac-episode-scope@1',episode_id:'fire-triggers',episode_format:'element_group',title_working:'Nhóm Lửa',topic_question:'Điều gì bị chạm?',member_ids:['aries','leo','sagittarius'],group_element:'fire',selection_reason:'Cùng nguyên tố, khác cơ chế'});
export const ledger=()=>({entries:['aries','leo','sagittarius','virgo','taurus','capricorn'].flatMap((member,i)=>['one.test','two.test'].map((host,j)=>({id:`E${i*2+j+1}`,url:`https://${host}/${member}`,scope:member,claim_scope:'member',member_ids:[member],claim_class:'astrology_interpretation',supported_interpretation:`Cơ chế riêng ${member} ${j}`})))});
test('selected evidence contains only selected members and never mutates the research ledger',()=>{
 const l=ledger(),before=structuredClone(l),v=compileEpisodeEvidenceView(l,episode());
 assert.deepEqual(Object.keys(v.member_claims),['aries','leo','sagittarius']);assert.equal(v.selected_refs.length,6);
 assert.ok(!JSON.stringify(v).includes('virgo'));assert.deepEqual(l,before);
});
test('element-level sources cannot masquerade as per-member evidence',()=>{
 const l=ledger();for(const e of l.entries)e.claim_scope='element';
 assert.throws(()=>compileEpisodeEvidenceView(l,episode()),/MEMBER_CORROBORATION/);
});
test('shared original authors across mirrors do not establish independence',()=>{
 const l=ledger();for(const e of l.entries)e.original_author='same-original-author';
 assert.throws(()=>compileEpisodeEvidenceView(l,episode()),/INDEPENDENT_SOURCES|MEMBER_CORROBORATION/);
});
test('missing member refs or an editorial inference cannot satisfy corroboration',()=>{
 const l=ledger();l.entries[1].claim_class='editorial_inference';
 assert.throws(()=>compileEpisodeEvidenceView(l,episode()),/MEMBER_CORROBORATION/);
});
