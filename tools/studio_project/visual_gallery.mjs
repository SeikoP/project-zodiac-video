// Read-only projection of the authoritative asset library; previews never grant review.
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {LIBRARY,json,confined,safeSvg,digest,describeAssets,assetUsage} from './visual_candidates.mjs';
import {THEMES} from './visual_themes.mjs';
import {compileCharacterSvg} from '../../plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4/characters/compile-character-assembly.mjs';
const image=svg=>'data:image/svg+xml;base64,'+Buffer.from(safeSvg(Buffer.from(svg))).toString('base64');
export async function describeGallery(history){
 const props=await describeAssets(),components=await json(path.join(LIBRARY,'characters/components/catalog.json'));
 const items=[];
 for(const row of props.items){const svg=await readFile(await confined(LIBRARY,row.path),'utf8');items.push({...row,preview_data_uri:image(svg),human_review:'PENDING'});}
 const identity={entity_id:'gallery-preview',body_profile:'standard_compact',hair_id:'asym-bang',face_profile_id:'balanced',outfit_id:'plain-shirt',shirt_color_id:'teal',variant_seed:'gallery-preview'};
 const state={pose_id:'neutral',expression_id:'neutral'};
 const groups={body_profiles:['body','body_profile'],hair:['hair','hair_id'],outfits:['outfit','outfit_id'],face_profiles:['face','face_profile_id'],poses:['pose','pose_id'],expressions:['expression','expression_id']};
 for(const [key,[role,field]]of Object.entries(groups))for(const component of components[key]){
  const acting={...state},person={...identity};(key==='poses'||key==='expressions'?acting:person)[field]=component.id;
  if(component.id==='zodiac-glyph-shirt')person.zodiac_sign_id='capricorn';
  const built=compileCharacterSvg(person,acting),svg=built.svg;
  items.push({id:role+':'+component.id,title:component.id,role,contexts:[component.style_intent??role],path:'characters/components/catalog.json',source_sha256:digest({component,svg}),preview_data_uri:image(svg),sockets:built.sockets,human_review:'PENDING',selection:{identity:person,state:acting}});
 }
 const accents=await json(path.join(LIBRARY,'scene-set/accents/index.json'));
 for(const row of accents.accents){const source='scene-set/'+row.path,svg=await readFile(await confined(LIBRARY,source),'utf8');if(digest(svg)!==row.asset_sha256)throw Error('VISUAL_ASSET_HASH_MISMATCH '+row.id);items.push({id:row.id,role:'context',contexts:[row.semantic_intent],path:source,source_sha256:digest(svg),preview_data_uri:image(svg),human_review:'PENDING'});}
 const memes=await json(path.join(LIBRARY,'memes/index.json'));
 for(const row of memes.compositions){const actor=Object.values(row.roles).find(r=>r.kind==='character'&&r.acting);if(!actor)continue;const acting={...state,...actor.acting},built=compileCharacterSvg(identity,acting);items.push({id:'meme:'+row.id,title:row.preview?.title??row.id,role:'meme',contexts:[row.mechanic_id,row.preview?.reaction??''],path:'memes/index.json',source_sha256:digest({row,svg:built.svg}),preview_data_uri:image(built.svg),selection:{identity,state:acting},required_contacts:row.required_contacts??[],preview_scope:'ACTOR_STATE_ONLY',human_review:'PENDING'});}
 return {format:'zodiac-studio-gallery@1',source_revision:digest(items.map(({id,source_sha256})=>({id,source_sha256}))),items:items.map(row=>({...row,usage:assetUsage(row,history)})),usage_evidence:history?{format:history.format,coverage:history.coverage,episode_count:history.records.length,not_an_approval:true}:null,themes:Object.values(THEMES),authority:'asset-library-v4',human_review:'PENDING',retired:['scene_set'],not_an_approval:true};
}
