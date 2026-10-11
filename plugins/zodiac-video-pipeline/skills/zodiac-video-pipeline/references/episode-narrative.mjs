import {assertEpisodeScope,MEMBER_LABELS} from '../orchestration/episode-scope.mjs';
const norm=s=>String(s??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replaceAll('đ','d').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function validateEpisodeNarrative(plan,narration){
 const scope=assertEpisodeScope(plan.episode_scope),lenses=plan.member_lenses;
 if(!Array.isArray(lenses)||lenses.length!==scope.member_ids.length||new Set(lenses.map(l=>l?.member_id)).size!==lenses.length||lenses.some(l=>!scope.member_ids.includes(l?.member_id)||!l.identity_mechanism?.trim()||!l.misread_vs_reframe?.trim()||!Array.isArray(l.archetype_facets)||!l.archetype_facets.length||!l.sign_swap_test?.irreplaceable_difference?.trim()))throw Error('EPISODE_NARRATIVE_LENSES');
 const covered=new Set();for(const b of plan.beats??[]){if(!Array.isArray(b.member_ids)||!b.member_ids.length||new Set(b.member_ids).size!==b.member_ids.length||b.member_ids.some(x=>!scope.member_ids.includes(x)))throw Error('EPISODE_BEAT_MEMBERS '+b.id);b.member_ids.forEach(x=>covered.add(x));}
 if(scope.member_ids.some(x=>!covered.has(x)))throw Error('EPISODE_NARRATIVE_MEMBER_COVERAGE');
 const spoken=norm(narration),opening=spoken.split(/\s+/).slice(0,40).join(' ');
 const labels=[scope.title_working,...scope.member_ids.map(id=>MEMBER_LABELS[id])];
 const opening_identity_review=!labels.some(x=>opening.includes(norm(x)));
 if(!labels.some(x=>spoken.includes(norm(x))))throw Error('EPISODE_OPENING_IDENTITY');
 if(scope.member_ids.some(id=>!spoken.includes(norm(MEMBER_LABELS[id]))))throw Error('EPISODE_SPOKEN_MEMBER_IDENTITY');
 return {status:'VALID',not_an_approval:true,opening_identity_review};
}
