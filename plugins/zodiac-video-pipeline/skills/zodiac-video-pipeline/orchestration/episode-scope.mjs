export const ELEMENT_MEMBERS=Object.freeze({fire:['aries','leo','sagittarius'],air:['gemini','libra','aquarius'],earth:['taurus','virgo','capricorn'],water:['cancer','scorpio','pisces']});
export const MEMBER_LABELS=Object.freeze({aries:'Bạch Dương',taurus:'Kim Ngưu',gemini:'Song Tử',cancer:'Cự Giải',leo:'Sư Tử',virgo:'Xử Nữ',libra:'Thiên Bình',scorpio:'Bọ Cạp',sagittarius:'Nhân Mã',capricorn:'Ma Kết',aquarius:'Bảo Bình',pisces:'Song Ngư'});
export const EPISODE_FORMATS=['single_sign','element_group','ranked_shortlist','comparison'];
const norm=s=>String(s??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replaceAll('đ','d').replace(/[^a-z0-9]/g,'');
const aliases=new Map(Object.entries(MEMBER_LABELS).flatMap(([id,label])=>[[norm(id),id],[norm(label),id]]));
export const canonicalMemberId=value=>aliases.get(norm(value))??null;
const nonempty=v=>typeof v==='string'&&Boolean(v.trim());
export function normalizeEpisodeScope(input){
 const s=structuredClone(input);if(!s||typeof s!=='object')return s;
 if(Array.isArray(s.member_ids))s.member_ids=s.member_ids.map(x=>canonicalMemberId(x)??x);
 if(s.ranking){if(Array.isArray(s.ranking.ordered_member_ids))s.ranking.ordered_member_ids=s.ranking.ordered_member_ids.map(x=>canonicalMemberId(x)??x);
 if(s.ranking.rationale_by_member){const ids=Object.keys(s.ranking.rationale_by_member).map(k=>canonicalMemberId(k)??k);if(new Set(ids).size!==ids.length)throw Error('EPISODE_RATIONALE_ALIAS_COLLISION');s.ranking.rationale_by_member=Object.fromEntries(Object.entries(s.ranking.rationale_by_member).map(([k,v])=>[canonicalMemberId(k)??k,v]));}}
 return s;
}
export function validateEpisodeScope(s,researchScope){
 const issues=[];const bad=m=>issues.push(m),members=s?.member_ids;
 if(s?.format!=='zodiac-episode-scope@1')bad('FORMAT');
 if(!/^[a-z0-9][a-z0-9-]{0,39}$/.test(s?.episode_id??''))bad('EPISODE_ID');
 for(const k of ['title_working','topic_question','selection_reason'])if(!nonempty(s?.[k]))bad(k);
 const limits={single_sign:[1,1],element_group:[3,3],ranked_shortlist:[2,5],comparison:[2,4]}[s?.episode_format];
 if(!limits)bad('EPISODE_FORMAT');
 if(!Array.isArray(members)||!members.length||members.some(x=>!Object.hasOwn(MEMBER_LABELS,x))||new Set(members).size!==members.length)bad('MEMBERS');
 else {
  if(limits&&(members.length<limits[0]||members.length>limits[1]))bad('CARDINALITY');
  if(s.episode_format==='element_group'){const expected=ELEMENT_MEMBERS[s.group_element];if(!expected||expected.length!==members.length||expected.some(x=>!members.includes(x)))bad('ELEMENT_MEMBERS');}
  if(s.episode_format==='comparison'&&!nonempty(s.comparison_axis))bad('COMPARISON_AXIS');
  if(researchScope){if(!Array.isArray(researchScope.candidate_member_ids)||members.some(x=>!researchScope.candidate_member_ids.includes(x)))bad('OUTSIDE_RESEARCH_POOL');if(!researchScope.permitted_formats?.includes(s.episode_format))bad('FORMAT_OUTSIDE_RESEARCH_SCOPE');}
  if(s.episode_format==='ranked_shortlist'){
   const r=s.ranking,order=r?.ordered_member_ids;
   if(!nonempty(r?.criterion)||!nonempty(r?.ordering_counterfactual)||!['ascending','descending'].includes(r?.direction)||r?.basis!=='editorial_interpretation')bad('RANK_CRITERION');
   if(!Array.isArray(order)||order.length!==members.length||new Set(order).size!==members.length||order.some(x=>!members.includes(x)))bad('RANK_ORDER');
   if(!r?.rationale_by_member||members.some(x=>!nonempty(r.rationale_by_member[x]))||Object.keys(r.rationale_by_member).some(x=>!members.includes(x)))bad('RANK_RATIONALE');
  }
 }
 return {status:issues.length?'BLOCKED':'VALID',issues};
}
export function assertEpisodeScope(scope,researchScope){const s=normalizeEpisodeScope(scope),r=validateEpisodeScope(s,researchScope);if(r.status==='BLOCKED')throw Error('EPISODE_SCOPE_INVALID '+r.issues.join(','));return s;}
export function validateResearchScope(s){
 const ids=s?.candidate_member_ids;
 if(s?.format!=='zodiac-research-scope@1'||!nonempty(s.topic_question)||!nonempty(s.source_scope)||!Array.isArray(ids)||ids.length<1||ids.length>6||new Set(ids).size!==ids.length||ids.some(x=>!Object.hasOwn(MEMBER_LABELS,x))||!Array.isArray(s.permitted_formats)||!s.permitted_formats.length||s.permitted_formats.some(x=>!EPISODE_FORMATS.includes(x)))throw Error('EPISODE_RESEARCH_SCOPE_INVALID');
 return s;
}
