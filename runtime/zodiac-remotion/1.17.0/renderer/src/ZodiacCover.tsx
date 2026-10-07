import React,{useEffect,useState} from "react";
import {AbsoluteFill,Img,cancelRender,continueRender,delayRender,staticFile} from "remotion";
import "@fontsource/be-vietnam-pro/vietnamese-500.css";
import type {CSSProperties} from "react";
import {PrimitiveSvg} from "./PrimitiveSvg";
import type {Production,PublishDocument,RenderProps,VisualState} from "./types";

const fontText="ă â ê ô ơ ư đ THIÊN BÌNH CHUYỆN MÌNH CHƯA CHỐT";
const useCoverFont=()=>{const [handle]=useState(()=>delayRender("Load cover font"));useEffect(()=>{document.fonts.load('500 80px "Be Vietnam Pro"',fontText).then((faces)=>{if(!faces.length)throw new Error("Cover font is unavailable.");continueRender(handle);}).catch((error)=>cancelRender(error instanceof Error?error:new Error(String(error))));},[handle]);};

const resolveCoverState=(production:Production,publish:PublishDocument,entityId:string,stateId:string)=>{
  const scene=production.scenes.find((item)=>item.id===publish.cover.source_scene_id);
  if(!scene)throw new Error("Cover source scene is missing: "+publish.cover.source_scene_id);
  const entity=scene.entities.find((item)=>item.id===entityId);
  if(!entity)throw new Error("Cover source entity is missing: "+entityId);
  const state=entity.states[stateId];
  if(!state)throw new Error(`Cover source state is missing: ${entityId}.${stateId}`);
  return state;
};

const CoverVisual:React.FC<{production:Production;publish:PublishDocument;entityId:string;stateId:string;transform?:VisualState["transform"]}>=({production,publish,entityId,stateId,transform})=>{
  const state=resolveCoverState(production,publish,entityId,stateId);
  const box=transform??state.transform;
  const style:CSSProperties={position:"absolute",left:box.x,top:box.y,width:box.width,height:box.height,zIndex:state.layer};
  if(state.asset){
    const asset=production.assets[state.asset];
    if(!asset)throw new Error("Cover asset is missing: "+state.asset);
    return <div style={style}><Img src={staticFile(asset.path)} style={{width:"100%",height:"100%",objectFit:"contain"}}/></div>;
  }
  const primitive=production.primitives[state.primitive??""];
  if(!primitive)throw new Error("Cover primitive is missing: "+state.primitive);
  return <PrimitiveSvg primitive={primitive} allowedTags={production.visual_system.primitive_renderer.allowed_tags} style={style} label={state.primitive??"cover visual"}/>;
};

export const ZodiacCover:React.FC<RenderProps>=({production,publish})=>{
  useCoverFont();
  if(!production?.video)throw new Error("Cover render props must include production.");
  if(!publish)throw new Error("Cover render props must include publish metadata.");
  const palette=production.visual_system.palette;
  return <AbsoluteFill style={{backgroundColor:palette.paper,fontFamily:"Be Vietnam Pro",color:palette.ink}}>
    <div style={{
      position:"absolute",left:120,top:250,width:840,height:138,
      display:"flex",alignItems:"center",justifyContent:"center",
      padding:"14px 28px",boxSizing:"border-box",borderRadius:32,
      backgroundColor:palette.ochre,border:`6px solid ${palette.ink}`,
      boxShadow:`0 8px 0 ${palette.soft_shadow}`,
      fontSize:64,lineHeight:1,fontWeight:500,textAlign:"center",zIndex:50,
    }}>{publish.cover.identity.label} {publish.cover.identity.glyph}</div>

    <div style={{
      position:"absolute",left:66,top:450,width:948,minHeight:340,
      display:"flex",alignItems:"center",justifyContent:"center",
      padding:"34px 44px",boxSizing:"border-box",
      backgroundColor:palette.card,border:`6px solid ${palette.ink}`,
      borderRadius:34,boxShadow:`14px 18px 0 ${palette.soft_shadow}`,
      transform:"rotate(-1.5deg)",transformOrigin:"center",
      fontSize:76,lineHeight:1.03,fontWeight:500,textAlign:"center",
      textTransform:"uppercase",zIndex:45,
    }}>{publish.cover.hook}</div>

    <div style={{
      position:"absolute",left:54,top:810,width:972,height:760,
      overflow:"hidden",zIndex:20,
    }}>
      <div style={{
        position:"absolute",left:-54,top:-420,
        width:production.video.width,height:production.video.height,
      }}>
        {publish.cover.visuals.map((item)=><CoverVisual
          key={`${item.entity_id}.${item.state_id}`}
          production={production}
          publish={publish}
          entityId={item.entity_id}
          stateId={item.state_id}
          transform={item.transform}
        />)}
      </div>
    </div>
  </AbsoluteFill>;
};
