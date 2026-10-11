import {assertEpisodeScope,MEMBER_LABELS} from '../orchestration/episode-scope.mjs';import {compositionHash} from '../orchestration/phase02-composition.mjs';
const norm=s=>String(s??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replaceAll('đ','d').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const fail=m=>{throw Error('EPISODE_REVIEW_INVALID '+m);};
export function validateEpisodeIdentityReview(review,plan,narration){
 const scope=assertEpisodeScope(plan.episode_scope),spoken=norm(narration);
 if(review?.scope_sha256!==compositionHash(scope))fail('SCOPE_DRIFT');
 const check=(c,label)=>{if(c?.result!=='PASS'||typeof c.objection!=='string'||c.objection.trim().length<25||typeof c.response!=='string'||c.response.trim().length<25||typeof c.evidence_excerpt!=='string')fail('UNRESOLVED '+label);const ex=norm(c.evidence_excerpt);if(ex.split(' ').length<3||!spoken.includes(ex))fail('EXCERPT '+label);return ex;};
 const rows=review.member_reviews;
 if(!Array.isArray(rows)||rows.length!==scope.member_ids.length||new Set(rows.map(r=>r?.member_id)).size!==rows.length)fail('MEMBER_COVERAGE');
 const distinct=new Set();
 for(const r of rows){if(!scope.member_ids.includes(r?.member_id)||r.decision!=='PASS')fail('MEMBER_DECISION');
  const swap=check(r.sign_swap,r.member_id+'.sign_swap'),insight=check(r.distinct_insight,r.member_id+'.distinct_insight');
  if(!swap.includes(norm(MEMBER_LABELS[r.member_id]))||!insight.includes(norm(MEMBER_LABELS[r.member_id])))fail('MEMBER_EXCERPT_OWNERSHIP');distinct.add(insight);
 }
 if(distinct.size!==rows.length)fail('RECYCLED_INSIGHT');
 check(review.group_thesis_review,'group_thesis');
 if(scope.episode_format==='ranked_shortlist'){
  if(review.ranking_review?.order_sha256!==compositionHash(scope.ranking.ordered_member_ids))fail('RANK_ORDER_DRIFT');
  check(review.ranking_review,'ranking');
 }
 return {status:'VALID',editorial_quality_verified:false,not_an_approval:true};
}
