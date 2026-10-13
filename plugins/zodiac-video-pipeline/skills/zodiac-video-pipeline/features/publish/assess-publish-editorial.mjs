// Editorial completeness for fresh packages. This does not assert viral performance or rendered pixels.
const text=value=>typeof value==='string'&&value.trim().length>0;
const wordCount=value=>String(value??'').trim().split(/\s+/u).filter(Boolean).length;
export function assessPublishEditorial(publish,scene,{fresh=false}={}){
 const issues=[];
 if(!fresh)return {status:'LEGACY_COMPATIBLE',issues};
 const add=(code,detail={})=>issues.push({code,...detail});
 const cover=publish?.cover??{};
 if(!text(publish?.title)||wordCount(publish.title)<7)add('PUBLISH_TITLE_INCOMPLETE');
 if(!text(cover.hook)||wordCount(cover.hook)<6)add('COVER_HOOK_TOO_THIN');
 if(!Array.isArray(publish?.hashtags)||publish.hashtags.length<5)add('PUBLISH_HASHTAG_COVERAGE_LOW');
 const entities=new Map((scene?.entities??[]).map(e=>[e.id,e]));
 const selected=new Set((cover.visuals??[]).map(v=>v.entity_id));
 const actors=[...entities.values()].filter(e=>e.kind==='character');
 if(actors.length&&!actors.some(e=>selected.has(e.id)))add('COVER_CHARACTER_MISSING');
 if(actors.length>1&&actors.some(e=>!selected.has(e.id))&&!text(cover.visual_omissions?.actors))
  add('COVER_CAST_INCOMPLETE');
 const semantic=[...entities.values()].filter(e=>['narrative_visual','story_object','story_symbol','object'].includes(e.kind));
 if(semantic.length&&!semantic.some(e=>selected.has(e.id))&&!text(cover.visual_omissions?.narrative_visual))
  add('COVER_SEMANTIC_VISUAL_MISSING');
 if(new Set((cover.visuals??[]).map(v=>v.entity_id)).size!==(cover.visuals??[]).length)add('COVER_VISUAL_DUPLICATE');
 return {status:issues.length?'REVIEW_REQUIRED':'EDITORIAL_STRUCTURE_PASS',issues};
}
