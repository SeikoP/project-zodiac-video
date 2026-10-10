import {resolveCoverVisuals} from './spatial-layout.mjs';
import React from "react";
import {AbsoluteFill, Img} from "remotion";
import type {RendererV2Props} from "./types";
import {useVerifiedCaptionFont} from "./ZodiacRenderPlan";

// Local-runner rendering is the only authority for final cover pixels.
// Legacy publish payloads are intentionally compatible with the old composition.
export const ZodiacCover: React.FC<RendererV2Props> = ({scenes, assets, presentation = {}, publish}) => {
  useVerifiedCaptionFont(presentation);
  const cover = publish?.cover;
  if (!cover) throw new Error("COVER_METADATA_MISSING: publish.cover");
  const scene = scenes.find((item) => item.id === cover.source_scene_id);
  if (!scene) throw new Error("COVER_SOURCE_SCENE_MISSING: " + cover.source_scene_id);
  const visuals = cover.visuals ?? [];
  if (!visuals.length) throw new Error("COVER_VISUALS_MISSING");
  const design = cover.design;
  if (design && (design.version !== "zodiac-cover-design@2" ||
    design.style_token !== "zodiac-paper-doodle-meme-v4" ||
    design.canvas?.width !== 1080 || design.canvas?.height !== 1920 ||
    design.title_frame?.shape !== "crooked-paper-note" ||
    design.title_frame?.fill_role !== "card" ||
    design.title_frame?.stroke_role !== "ink" ||
    design.title_frame?.shadow_role !== "soft_shadow" ||
    design.composition?.background_policy !== "preserve-native-environment"))
    throw new Error("COVER_DESIGN_UNSUPPORTED: v2 token/shape/canvas");
  const c = design?.composition;
  const minSideMargin = c?.min_side_margin_px ?? 72;
  if (!Number.isFinite(minSideMargin) || minSideMargin < 72 || minSideMargin > 135)
    throw new Error("COVER_DESIGN_UNSUPPORTED: min_side_margin_px");
  const heroScale = c?.hero_scale ?? 1;
  const propScale = c?.supporting_prop_scale ?? 1;
  if (design && (!(heroScale >= 0.82 && heroScale <= 0.90) ||
    !(propScale >= 0.75 && propScale <= 0.85) ||
    c?.read_order?.join(",") !== "hook,identity,character_story_object" ||
    !Number.isInteger(c?.max_supporting_accents) || c!.max_supporting_accents < 0 || c!.max_supporting_accents > 2))
    throw new Error("COVER_DESIGN_UNSUPPORTED: composition");
  const visualsResolved = resolveCoverVisuals(visuals, scene, assets, {width:900,height:720});
  const accents = visualsResolved.filter(v => v.role === "effect");
  if (design && accents.length > (c?.max_supporting_accents ?? 2))
    throw new Error("COVER_COMPOSITION_DENSITY: too many supporting effects");
  const captionFont = presentation.caption?.font_family ?? "Patrick Hand";
  const paper = presentation.paper ?? "#F6F0E6";
  const ink = presentation.ink ?? "#2F3C44";
  const card = "#FFFDF9", ochre = "#F2C45C", warmShadow = "#D0C1B3";
  const dx = design?.title_frame.shadow_dx_px ?? 3;
  const dy = design?.title_frame.shadow_dy_px ?? 6;
  const opacity = design?.title_frame.shadow_opacity ?? 0.30;
  if (design && (![dx,dy,opacity].every(Number.isFinite) || dx < 0 || dx > 4 ||
    dy < 2 || dy > 8 || opacity < 0.22 || opacity > 0.38 ||
    design.title_frame.max_lines < 2 || design.title_frame.max_lines > 3 ||
    design.title_frame.font_family !== "Patrick Hand"))
    throw new Error("COVER_DESIGN_UNSUPPORTED: title_frame");
  const paperOutline = "M14 10 C157 4 280 14 433 7 S698 8 862 5 Q870 5 870 15 C874 86 865 152 873 227 Q873 264 878 292 Q864 304 844 307 C701 301 572 312 430 305 S164 310 17 303 Q9 302 9 291 C5 214 13 137 7 57 Q4 26 14 10 Z";
  const identityOutline = "M24 7 C211 3 333 10 482 6 S716 8 834 5 Q852 7 851 24 C847 51 855 82 850 105 Q848 124 829 123 C649 128 460 120 277 125 S95 121 25 124 Q8 122 9 106 C12 82 5 48 10 25 Q11 10 24 7 Z";
  const paperTilt = design ? "rotate(-2deg)" : "rotate(-1deg)";
  const titleWidth = 1080 - 2*minSideMargin;
  const titleLeft = minSideMargin;
  return (
    <AbsoluteFill style={{backgroundColor:paper,color:ink,fontFamily:captionFont}}>
      {design ? <svg aria-hidden viewBox="0 0 860 130" preserveAspectRatio="none"
        style={{position:"absolute",top:266,left:110,width:860,height:130,overflow:"visible"}}>
        <path d={identityOutline} fill={warmShadow} transform="translate(5 8)"/>
        <path d={identityOutline} fill={ochre} stroke={ink} strokeWidth={6}
          strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
      </svg> : null}
      <div style={{position:"absolute",top:266,left:110,width:860,minHeight:130,
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:67,
        border:design?undefined:`5px solid ${ink}`,borderRadius:design?undefined:23,
        background:design?undefined:ochre,
        fontWeight:400,textAlign:"center",padding:15,boxSizing:"border-box"}}>
        {cover.identity.label} {cover.identity.glyph}
      </div>
      {design ? <svg aria-hidden viewBox="0 0 880 312" preserveAspectRatio="none"
        style={{position:"absolute",top:450,left:titleLeft,width:titleWidth,height:312,
          overflow:"visible",transform:paperTilt}}>
        {/* Flat warm paper relief must remain visible at phone thumbnail size. */}
        <path d={paperOutline} fill={warmShadow}
          transform={`translate(${Math.max(dx,16)} ${Math.max(dy,24)})`}/>
        <path d={paperOutline} fill={card} stroke={ink} strokeWidth={6}
          strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
      </svg> : null}
      <div style={{position:"absolute",top:450,left:titleLeft,width:titleWidth,minHeight:312,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:cover.hook.length>64?66:76,lineHeight:1.08,textAlign:"center",
        padding:"24px 38px",boxSizing:"border-box",overflow:"hidden",
        border:design?undefined:`6px solid ${ink}`,
        borderRadius:design?0:30,
        background:design?undefined:card,
        transform:paperTilt,fontWeight:400,
        WebkitTextStroke:design?"0.2px transparent":undefined}}>
        <span style={{width:"100%",textWrap:design?"balance":undefined}}>{cover.hook}</span>
      </div>
      <div style={{position:"absolute",left:90,top:790,width:900,height:720,overflow:"visible"}}>
        {visualsResolved.map(({visual,state,src,box,order,role}) => {
          const roleScale=design?(role==="character"?heroScale:role==="interactive_prop"||role==="effect"?propScale:1):1;
          const scale=(visual.transform?.scale ?? state.transform?.scale ?? 1)*roleScale;
          const fadedBackground=design && role==="background";
          return <Img key={visual.entity_id+"."+visual.state_id} src={src}
            style={{position:"absolute",left:box.x,top:box.y,width:box.width,height:box.height,
              transform:`scale(${scale}) rotate(${visual.transform?.rotation ?? state.transform?.rotation ?? 0}deg)`,
              zIndex:order,objectFit:"contain",opacity:fadedBackground?0.40:1}}/>;
        })}
      </div>
      <div style={{position:"absolute",left:82,top:1550,fontSize:35,opacity:.5}}>
        ✦ bungmoto
      </div>
    </AbsoluteFill>
  );
};
