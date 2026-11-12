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
