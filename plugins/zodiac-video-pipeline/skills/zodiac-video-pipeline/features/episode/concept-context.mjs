import {readFile} from 'node:fs/promises';
import path from 'node:path';
const text=v=>typeof v==='string'?v.trim():'';
export function conceptContext(plan,scope={}){
 const premise=text(plan?.story_spine?.premise);
 if(!premise)return null;
 return {format:'zodiac-concept-context@1',id:text(plan.selected_concept_id)||null,premise,
  episode_id:text(scope.episode_id)||null,title:text(scope.title_working)||null,
  member_ids:Array.isArray(scope.member_ids)?scope.member_ids.filter(x=>typeof x==='string'):[]};
}
export async function readConceptContext(root){
 const read=async name=>{try{return JSON.parse(await readFile(path.join(root,'.authoring',name),'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}};
 return conceptContext(await read('narrative-plan.json'),await read('episode-scope.json')??{});
}
