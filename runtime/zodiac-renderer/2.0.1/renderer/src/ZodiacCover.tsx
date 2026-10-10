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
  const crooked = "polygon(1% 1%, 99% 0%, 100% 96%, 96% 100%, 1% 99%, 0% 5%)";
  const titleWidth = 1080 - 2*minSideMargin;
  const titleLeft = minSideMargin;
  return (
    <AbsoluteFill style={{backgroundColor:paper,color:ink,fontFamily:captionFont}}>
      <div style={{position:"absolute",top:266,left:110,width:860,minHeight:130,
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:67,
        border:`5px solid ${ink}`,borderRadius:23,background:ochre,
        boxShadow:design?`3px 5px 0px ${warmShadow}`:undefined,
        fontWeight:400,textAlign:"center",padding:15,boxSizing:"border-box"}}>
        {cover.identity.label} {cover.identity.glyph}
      </div>
      {design ? <div aria-hidden style={{position:"absolute",top:450+dy,left:titleLeft+dx,
        width:titleWidth,height:312,background:warmShadow,opacity,
        clipPath:crooked,transform:"rotate(-1deg)"}}/> : null}
      <div style={{position:"absolute",top:450,left:titleLeft,width:titleWidth,minHeight:312,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:cover.hook.length>64?66:76,lineHeight:1.08,textAlign:"center",
        padding:"24px 38px",boxSizing:"border-box",overflow:"hidden",
        border:design?undefined:`6px solid ${ink}`,
        outline:design?undefined:undefined,borderRadius:design?0:30,
        background:card,clipPath:design?crooked:undefined,
        transform:"rotate(-1deg)",fontWeight:400,
        boxShadow:design?undefined:undefined,
        WebkitTextStroke:design?"0.2px transparent":undefined}}>
        {cover.hook}
      </div>
      {design ? <div aria-hidden style={{position:"absolute",top:453,left:titleLeft+4,width:titleWidth-8,
        height:301,border:`4px solid ${ink}`,pointerEvents:"none",
        clipPath:crooked,transform:"rotate(-1deg)",boxSizing:"border-box"}}/> : null}
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
