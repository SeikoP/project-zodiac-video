import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeEpisodeScope,validateEpisodeScope} from '../episode-scope.mjs';
export const scope=()=>({format:'zodiac-episode-scope@1',episode_id:'fire-triggers',episode_format:'element_group',title_working:'Nhóm Lửa không nóng vì cùng một chuyện',topic_question:'Họ bảo vệ điều gì?',member_ids:['aries','leo','sagittarius'],selection_reason:'Cùng nguyên tố, khác động cơ.',group_element:'fire'});
test('canonical aliases and all four exact element groups validate without input mutation',()=>{
 const s=scope();s.member_ids=['Bạch Dương','Sư Tử','Nhân Mã'];const copy=structuredClone(s),n=normalizeEpisodeScope(s);
 assert.deepEqual(n.member_ids,['aries','leo','sagittarius']);assert.deepEqual(s,copy);assert.equal(validateEpisodeScope(n).status,'VALID');
 for(const [group_element,member_ids] of Object.entries({air:['gemini','libra','aquarius'],earth:['taurus','virgo','capricorn'],water:['cancer','scorpio','pisces']}))assert.equal(validateEpisodeScope({...scope(),group_element,member_ids}).status,'VALID');
});
test('wrong group, duplicates, unknown members and oversized episodes are blocked',()=>{
 for(const patch of [{member_ids:['aries','leo','virgo']},{member_ids:['aries','leo','leo']},{member_ids:['made-up','leo','sagittarius']},{episode_format:'ranked_shortlist',member_ids:['aries','leo','sagittarius','virgo','taurus','capricorn']},{episode_format:'freeform'},{episode_id:'../escape'}])assert.equal(validateEpisodeScope({...scope(),...patch}).status,'BLOCKED');
});
test('single and comparison cardinality and research pool containment are enforced',()=>{
 const s={...scope(),episode_format:'single_sign',member_ids:['leo']};delete s.group_element;
 assert.equal(validateEpisodeScope(s).status,'VALID');assert.equal(validateEpisodeScope({...s,member_ids:['leo','aries']}).status,'BLOCKED');
 assert.equal(validateEpisodeScope({...s,episode_format:'comparison',member_ids:['leo','aries'],comparison_axis:'Cách giữ quyền chủ động'}).status,'VALID');
 assert.equal(validateEpisodeScope(scope(),{candidate_member_ids:['aries','leo'],permitted_formats:['element_group']}).status,'BLOCKED');
});
test('rank requires a real criterion and a permutation with per-member rationale',()=>{
 const s={...scope(),episode_format:'ranked_shortlist',ranking:{criterion:'Cách phản ứng với trì hoãn',direction:'descending',basis:'editorial_interpretation',ordered_member_ids:['leo','aries','sagittarius'],rationale_by_member:{leo:'Lý do L',aries:'Lý do A',sagittarius:'Lý do S'},ordering_counterfactual:'Nếu đổi tiêu chí sang tìm trải nghiệm mới, thứ tự phải thay đổi.'}};delete s.group_element;
 assert.equal(validateEpisodeScope(s).status,'VALID');s.ranking.ordered_member_ids=['leo','leo','aries'];assert.equal(validateEpisodeScope(s).status,'BLOCKED');
});
