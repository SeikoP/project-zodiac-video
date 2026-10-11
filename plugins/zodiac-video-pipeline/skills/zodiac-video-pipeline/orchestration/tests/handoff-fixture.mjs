import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {projectProduction} from '../compile-runtime-production.mjs';

export const v4Token={
  id:'zodiac-paper-doodle-meme-v4',version:'4.0',style_family:'paper-doodle-chibi-meme',handmade_profile:'human-stroke-v2',hard_style_lock:true,
  palette_roles:{paper:'#F6F0E6',card:'#FFFDF9',ink:'#2F3C44',soft_ink:'#5C6B75',hair_ink:'#4B5B61',skin:'#F1C6A0',sticker_edge:'#FFFDF9',soft_shadow:'#D0C1B3',teal:'#8EC0B9',coral:'#E97A66',ochre:'#F2C45C',slate:'#435064'},
  character_construction:{handmade_profile:'human-stroke-v2',identity_rule:'body_profile + hair_id + outfit_id; pose/expression are state only',body_variation:'authored_geometry_not_scale_transform'},
  shape_language:{medium:'handmade-paper-doodle-stickers',geometry_preference:'path-first',density:'one-focal-interaction-one-supporting-prop'},
  caption_emphasis:{font_family:'Patrick Hand',font_weight:400,font_size_px:84,min_font_size_px:64,max_lines:2,color_role:'ink',highlight_role:'coral',background_role:'sticker_edge',ghost_frame:true,segmentation:'semantic-sentence-or-natural-clause'},
  safe_zone:{x:72,y:960,width:936,height:620},caption_overlay:{mode:'collision_aware',preferred_anchor:'lower_center',max_visual_overlap_ratio:0.24,edge_margin_px:72,paper_halo_px:18},
  motion_grammar:{state_swap:'voice-anchored-pose-or-expression-change',camera_focus:'restrained-focus-shift',freeze_then_release:'hold-reaction-then-resume'},
  asset_style_contract:{style_token:'zodiac-paper-doodle-meme-v4',handmade_profile:'human-stroke-v2',legacy_v3_direct_copy:false}
};
export const design=`<!-- STYLE_TOKEN_BEGIN -->\n\`\`\`json\n${JSON.stringify(v4Token)}\n\`\`\`\n<!-- STYLE_TOKEN_END -->\n`;
export async function makeCanonicalJob(version='1.59.0'){
  const d=await mkdtemp(path.join(os.tmpdir(),'zodiac-handoff-'));await mkdir(path.join(d,'assets'),{recursive:true});await mkdir(path.join(d,'publish'),{recursive:true});
  const lineage={mode:'composite',source_library:'zodiac-visual-grammar-v4',source_master:['body:standard_compact','hair:female-messy-bun','outfit:scorpio'],semantic_intent:'hero neutral'};
  const authoring={version:'2.0',video:{width:1080,height:1920,fps:24},visual_system:{style_token:{id:v4Token.id,version:'4.0'}},assets:{HERO_NEUTRAL:{path:'assets/hero.svg',style_id:v4Token.id,category:'character_pose',lineage},HERO_POINT:{path:'assets/hero.svg',style_id:v4Token.id,category:'character_pose',lineage}},scenes:[{id:'S01',voice:'Xử Nữ đổi góc nhìn.',entities:[{id:'hero',kind:'character',initial_state:'neutral',states:{neutral:{asset:'HERO_NEUTRAL',transform:{x:120,y:240,width:360,height:520},layer:20,visible:true},point:{asset:'HERO_POINT',transform:{x:120,y:240,width:360,height:520},layer:20,visible:true}}}],events:[{id:'E1',target:'hero',action:'points',state_before:'neutral',state_after:'point',trigger:{source:'scene_start'}}],captions:{source:'voice',segmentation:'semantic',max_lines:2}}]};
  const production=projectProduction(authoring,design);
  await writeFile(path.join(d,'design.md'),design);await writeFile(path.join(d,'production.json'),JSON.stringify(production));await writeFile(path.join(d,'assets/hero.svg'),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>');await writeFile(path.join(d,'narration.txt'),'Xử Nữ đổi góc nhìn.\n');
  await writeFile(path.join(d,'package-manifest.json'),JSON.stringify({format:'zodiac-job@4',production_contract:'2.0',runtime:{id:'zodiac-remotion',version:'1.21.0'},producer:{plugin:'zodiac-video-pipeline',version}}));
  await writeFile(path.join(d,'publish/publish.json'),JSON.stringify({version:'1.5',platform:'tiktok',cover:{layout:'tilted_top_hook',identity:{sign_id:'virgo',label:'XỬ NỮ',glyph:'♍'},hook:'Đổi góc nhìn',source_scene_id:'S01',visuals:[{entity_id:'hero',state_id:'point'}]},caption:'Xử Nữ đổi góc nhìn.',hashtags:['#XuNu'],source:{narration:'narration.txt',production:'production.json'}}));
  await writeFile(path.join(d,'publish/publish-copy.txt'),'COVER IDENTITY: XỬ NỮ\nHOOK: Đổi góc nhìn\nTIKTOK CAPTION: Xử Nữ đổi góc nhìn.\nHASHTAGS: #XuNu\n');return d;
}
