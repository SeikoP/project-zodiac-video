import {resolveVisualRole, resolveLayerOrder} from './visual-role.mjs';
import {resolveCaptionZone} from './caption-layout.mjs';
import {CAPTION_STROKE_PX, CAPTION_STROKE_COLOR, resolveCaptionWordLines} from './caption-karaoke.mjs';
import {resolveDisplayedEntityState} from './spatial-layout.mjs';
import React, {useEffect, useState} from "react";
import {AbsoluteFill, Img, Sequence, useCurrentFrame, delayRender, continueRender, cancelRender} from "remotion";

import {resolveSemanticMotion} from "./semantic-motion.mjs";

import type {
  RenderPlanPresentation,
  RenderPlanScene,
  RendererV2Props,
} from "./types";

export const useVerifiedCaptionFont = (presentation: RenderPlanPresentation) => {
  const needsFont = presentation.caption?.font_family === "Patrick Hand";
  const fontUri = presentation.caption?.font_data_uri;
  const [handle] = useState(() => delayRender("Verify caption font", {timeoutInMilliseconds: 30000}));
  useEffect(() => {
    let active = true;
    const run = async () => {
      if (needsFont) {
        if (!fontUri?.startsWith("data:font/ttf;base64,")) {
          throw new Error("FONT_LOAD_FAILED requested=Patrick Hand actual=missing fallback=false");
        }
        const font = new FontFace("Patrick Hand", `url("${fontUri}")`, {weight: "400"});
        await font.load();
        document.fonts.add(font);
        if (!document.fonts.check('400 84px "Patrick Hand"')) {
          throw new Error("FONT_LOAD_FAILED requested=Patrick Hand actual=unavailable fallback=false");
        }
        console.info("Patrick Hand loaded; fallback=false; requested=Patrick Hand; actual=Patrick Hand");
      }
      if (active) continueRender(handle);
    };
    run().catch((error) => {
      if (active) cancelRender(error instanceof Error ? error : new Error(String(error)));
    });
    return () => {active = false;};
  }, [handle, needsFont, fontUri]);
};

const SceneLayer: React.FC<{
  scene: RenderPlanScene;
  assets: RendererV2Props["assets"];
  presentation: RenderPlanPresentation;
  video: RendererV2Props["video"];
}> = ({scene, assets, presentation, video}) => {
  const relativeFrame = useCurrentFrame();
  const frame = relativeFrame + scene.start_frame;
  const captions = scene.captions ?? [];
  const caption = captions.find(
    (item) => frame >= item.start_frame && frame < item.end_frame,
  );
  const safe = resolveCaptionZone(scene, presentation, video);
  const textLayout = caption?.resolved_layout;
  if (caption && !textLayout) throw new Error(`CAPTION_LAYOUT_MISSING scene=${scene.id} frame=${frame}`);
  const wordLines: Array<Array<{text: string; active: boolean; lift: number}>> = caption
    ? resolveCaptionWordLines(caption, frame) : [];
  const activeFor = (entityId: string) => scene.events.find(item =>
    item.target === entityId && frame >= item.start_frame && frame < item.end_frame);
  const states = Object.fromEntries((scene.entities ?? []).map(entity=>[entity.id,resolveDisplayedEntityState(scene,entity,frame)]));

  return (
    <AbsoluteFill>
      {resolveLayerOrder(scene, assets, states)
        .map((entity, index) => {
          const state = states[entity.id];
          const assetId = state?.asset;
          if (!state || state.visible === false || !assetId) return null;
          const asset = assets[assetId];
          const src = asset?.src;
          if (!src) throw new Error(`RENDER_ASSET_MISSING scene=${scene.id} entity=${entity.id} asset=${assetId}`);
          const transform = state.transform ?? {};
          const role = resolveVisualRole(entity, assets);
          // Explicit semantic motion only. No ambient idle motion for unrelated actors.
          const active=activeFor(entity.id);
          const resolved=resolveSemanticMotion(active,scene,entity,frame);
          const style: React.CSSProperties = {
            position: "absolute",
            left: transform.x ?? 0,
            top: transform.y ?? 0,
            width: transform.width ?? 520,
            height: transform.height ?? 520,
            transform: `translate(${resolved.translateX}px, ${resolved.translateY}px) scale(${(transform.scale ?? 1) * resolved.scale}) rotate(${(transform.rotation ?? 0) + resolved.rotateDeg}deg)`,
            zIndex: index,
            opacity: resolved.opacity,
            objectFit: "contain",
            transformOrigin: "center center",
          };
          return (
            <Img
              key={entity.id}
              src={src}
              data-entity-id={entity.id}
              data-asset-id={assetId}
              data-visual-role={role}
              data-narrative-focus={active ? "active" : "inactive"}
              data-motion-preset={active?.motion ?? "none"}
              data-motion-peak={resolved.peak.toFixed(3)}
              style={style}
            />
          );        })}

      {caption ? (
        <div
          data-caption="active"
          style={{
            position: "absolute",
            left: textLayout!.x,
            top: textLayout!.y,
            width: textLayout!.width,
            minHeight: textLayout!.height,
            overflow: "visible",
            lineHeight: safe.lineHeight,
            whiteSpace: "pre",
            overflowWrap: "normal",
            wordBreak: "normal",
            fontFamily: presentation.caption?.font_family ?? "sans-serif",
            fontSize: presentation.caption?.font_size_px ?? 84,
            fontWeight: presentation.caption?.font_weight ?? 400,
            color: presentation.caption?.color ?? presentation.ink ?? "#111111",
            WebkitTextStroke: `${CAPTION_STROKE_PX}px ${CAPTION_STROKE_COLOR}`,
            textShadow: "0px 2px 3px rgba(47, 60, 68, 0.18)",
            paintOrder: "stroke fill",
            textAlign: "center",
            zIndex: 90,
          }}
        >
          {wordLines.map((line, lineIndex) => (
            <React.Fragment key={lineIndex}>
              {lineIndex > 0 ? "\n" : null}
              {line.map((part, partIndex) => (
                <span key={partIndex} data-caption-word={part.active ? "active" : undefined}
                  style={{position: "relative", top: -part.lift,
                    color: part.active ? (presentation.caption?.highlight_color ?? "#e97a66") : undefined}}>
                  {part.text}
                </span>
              ))}
            </React.Fragment>
          ))}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const Watermark: React.FC<{presentation: RenderPlanPresentation}> = ({presentation}) => {
  const watermark = presentation.watermark;
  if (!watermark?.enabled || !watermark.text) return null;
  const offset = watermark.offset_px ?? {};
  const hasVectorStar = watermark.text.trim().startsWith("✦");
  const label = hasVectorStar ? watermark.text.trim().slice(1).trimStart() : watermark.text;
  return (
    <div
      data-watermark="brand"
      style={{
        position: "absolute",
        left: offset.x ?? 68,
        top: offset.y ?? 40,
        fontFamily: watermark.font_family ?? "sans-serif",
        fontSize: watermark.font_size_px ?? 29,
        fontWeight: watermark.font_weight ?? 400,
        opacity: watermark.opacity ?? 0.45,
        color: presentation.ink ?? "#111111",
        zIndex: watermark.layer ?? 100,
        display: "flex", alignItems: "center", gap: 5,
      }}
    >
      {hasVectorStar ? <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0 L15.2 8.8 L24 12 L15.2 15.2 L12 24 L8.8 15.2 L0 12 L8.8 8.8 Z"/></svg> : null}
      <span>{label}</span>
    </div>
  );
};

export const ZodiacRenderPlan: React.FC<RendererV2Props> = ({
  scenes,
  assets,
  presentation = {},
  video,
}) => {
  useVerifiedCaptionFont(presentation);
  return (
  <AbsoluteFill style={{backgroundColor: presentation.paper ?? "#ffffff"}}>
    {scenes.map((scene) => (
      <Sequence
        key={scene.id}
        from={scene.start_frame}
        durationInFrames={scene.duration_frames}
      >
        <SceneLayer scene={scene} assets={assets} presentation={presentation} video={video} />
      </Sequence>
    ))}
    <Watermark presentation={presentation} />
  </AbsoluteFill>
  );
};
