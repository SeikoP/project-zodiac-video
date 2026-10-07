import React from "react";
import "@fontsource/patrick-hand/vietnamese-400.css";
import type {CSSProperties} from "react";
import type {Production} from "./types";

type BrandOverlayContract = {
  enabled: boolean;
  text: string;
  symbol: string;
  brand: string;
  anchor: "top-left" | "top-center" | "top-right";
  offset_px: {x: number; y: number};
  font_family: string;
  font_stack?: string[];
  css_font_family?: string;
  font_size_px: number;
  font_weight: number;
  symbol_scale: number;
  gap_px: number;
  opacity: number;
  tone: string;
  paper_halo: boolean;
  layer: number;
  subtitle_layer?: number;
};

const overlayOf=(production:Production):BrandOverlayContract|undefined =>
  (production.visual_system as Production["visual_system"] & {brand_overlay?:BrandOverlayContract}).brand_overlay;

const anchorStyle=(overlay:BrandOverlayContract):CSSProperties=>{
  if(overlay.anchor==="top-center") return {left:"50%",transform:"translateX(-50%)"};
  if(overlay.anchor==="top-right") return {right:overlay.offset_px.x};
  return {left:overlay.offset_px.x};
};

export const BrandOverlay:React.FC<{production:Production}>=({production})=>{
  const overlay=overlayOf(production);
  if(!overlay?.enabled) return null;
  const palette=production.visual_system.palette;
  const color=palette[overlay.tone] ?? overlay.tone ?? palette.ink;
  const fontFamily=overlay.css_font_family?.trim() || '"Patrick Hand", "Segoe Print", cursive';
  const common:CSSProperties={
    position:"absolute",
    top:overlay.offset_px.y,
    zIndex:overlay.layer,
    display:"flex",
    alignItems:"center",
    whiteSpace:"nowrap",
    pointerEvents:"none",
    userSelect:"none",
    color,
    opacity:overlay.opacity,
    fontFamily,
    fontSize:overlay.font_size_px,
    fontWeight:overlay.font_weight,
    lineHeight:1,
    letterSpacing:"0.01em",
    textShadow:overlay.paper_halo
      ? "0 0 14px rgba(255,253,249,0.96), 0 0 24px rgba(255,253,249,0.72)"
      : "none",
    ...anchorStyle(overlay),
  };
  const hasParts=Boolean(overlay.symbol || overlay.brand);
  return <div style={common} aria-label={overlay.text}>
    {hasParts ? <>
      {overlay.symbol ? <span style={{fontSize:`${overlay.symbol_scale*100}%`,marginRight:overlay.brand?overlay.gap_px:0,lineHeight:1}}>{overlay.symbol}</span> : null}
      {overlay.brand ? <span style={{lineHeight:1}}>{overlay.brand}</span> : null}
    </> : overlay.text}
  </div>;
};
