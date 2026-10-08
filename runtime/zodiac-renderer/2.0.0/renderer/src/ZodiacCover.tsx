import React from "react";
import {AbsoluteFill, Img} from "remotion";
import type {RendererV2Props} from "./types";
import {useVerifiedCaptionFont} from "./ZodiacRenderPlan";

// Job@5 cover consumes the same hydrated SVG assets, caption font and
// authored entity state as the video. Never generate an AI image here.
export const ZodiacCover: React.FC<RendererV2Props> = ({scenes, assets, presentation = {}, publish}) => {
  useVerifiedCaptionFont(presentation);
  const cover = publish?.cover;
  if (!cover) throw new Error("COVER_METADATA_MISSING: publish.cover");
  const scene = scenes.find((item) => item.id === cover.source_scene_id);
  if (!scene) throw new Error("COVER_SOURCE_SCENE_MISSING: " + cover.source_scene_id);
  const visuals = cover.visuals ?? [];
  if (!visuals.length) throw new Error("COVER_VISUALS_MISSING");
  const visualsResolved = visuals.map((visual) => {
    const entity = scene.entities?.find((item) => item.id === visual.entity_id);
    const state = entity?.states[visual.state_id];
    const asset = state?.asset ? assets[state.asset] : undefined;
    if (!entity || !state || !asset?.src) {
      throw new Error(`COVER_VISUAL_MISSING: ${visual.entity_id}.${visual.state_id}`);
    }
    return {visual, state, src:asset.src};
  });
  const captionFont = presentation.caption?.font_family ?? "sans-serif";
  const paper = presentation.paper ?? "#F6F0E6";
  const ink = presentation.ink ?? "#2F3C44";
  return (
    <AbsoluteFill style={{backgroundColor:paper, color:ink, fontFamily:captionFont}}>
      <div style={{position:"absolute",top:260,left:110,width:860,minHeight:130,
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:67,
        border:`5px solid ${ink}`,borderRadius:28,background:"#F2C45C",
        fontWeight:400,textAlign:"center",padding:15}}>
        {cover.identity.label} {cover.identity.glyph}
      </div>
      <div style={{position:"absolute",top:450,left:70,width:940,minHeight:310,
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:78,
        lineHeight:1.08,textAlign:"center",padding:30,boxSizing:"border-box",
        border:`6px solid ${ink}`,borderRadius:30,background:"#FFFDF9",
        transform:"rotate(-1deg)",fontWeight:400}}>
        {cover.hook}
      </div>
      <div style={{position:"absolute",left:90,top:790,width:900,height:720,overflow:"hidden"}}>
        {visualsResolved.map(({visual,state,src},index) => {
          // Position the chosen SVG's existing state within the cover region.
          const t = visual.transform ?? state.transform ?? {};
          const targetWidth = Math.min(860,Math.max(260,t.width ?? 520));
          const targetHeight = Math.min(690,Math.max(330,t.height ?? 610));
          return <Img key={visual.entity_id+"."+visual.state_id+"."+index} src={src}
            style={{position:"absolute",left:(900-targetWidth)/2,top:30+index*35,
              width:targetWidth,height:targetHeight,objectFit:"contain"}}/>;
        })}
      </div>
      <div style={{position:"absolute",left:82,top:1550,fontSize:35,opacity:.5}}>
        ✦ bungmoto
      </div>
    </AbsoluteFill>
  );
};
