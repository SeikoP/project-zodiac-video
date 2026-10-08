import React, {useEffect, useState} from "react";
import {semanticMotionAtFrame} from "./semantic-motion.mjs";
import {AbsoluteFill, Img, Sequence, useCurrentFrame, delayRender, continueRender, cancelRender} from "remotion";

import type {
  RenderPlanEntity,
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

// Keep a single entity coordinate space while blending states; do not shift the
// subject or create additional authored SVGs to hide a hard pose cut.
const stateForFrame = (
  scene: RenderPlanScene,
  entity: RenderPlanEntity,
  frame: number,
  assets: RendererV2Props["assets"],
) => {
  let stateId = entity.initial_state;
  let lastResolvedAfterAsset: string | undefined;
  let activeEvent: RenderPlanScene["events"][number] | undefined;
  for (const event of [...scene.events].filter((e) => e.target === entity.id).sort(
    (a, b) => a.start_frame - b.start_frame,
  )) {
    if (frame >= event.end_frame) {
      stateId = event.state_after;
      lastResolvedAfterAsset = assets[event.asset_after] ? event.asset_after : undefined;
      continue;
    }
    if (frame >= event.start_frame) {
      activeEvent = event;
      const before = entity.states[event.state_before];
      const after = entity.states[event.state_after];
      const entering = before?.visible === false && after?.visible !== false;
      const bothVisible = before?.visible !== false && after?.visible !== false;
      const midpoint = event.start_frame + Math.floor((event.end_frame - event.start_frame) / 2);
      // Entering effects appear at the event start, never several words late.
      // Other state swaps use one complete SVG, changed at the action midpoint.
      stateId = entering || (bothVisible && frame >= midpoint) ? event.state_after : event.state_before;
      break;
    }
  }
  const state = entity.states[stateId] ?? entity.states[entity.initial_state];
  return {state, assetId: state?.asset ?? lastResolvedAfterAsset, activeEvent};
};

const SceneLayer: React.FC<{
  scene: RenderPlanScene;
  assets: RendererV2Props["assets"];
  presentation: RenderPlanPresentation;
}> = ({scene, assets, presentation}) => {
  const relativeFrame = useCurrentFrame();
  const frame = relativeFrame + scene.start_frame;
  const captions = scene.captions ?? [];
  const caption = captions.find(
    (item) => frame >= item.start_frame && frame < item.end_frame,
  );
  const captionStyle = presentation.caption ?? {};
  const safe = scene.layout_contract?.caption_safe_zone ?? captionStyle.safe_zone ?? {};

  return (
    <AbsoluteFill>
      {[...(scene.entities ?? [])]
        .sort((a, b) => {
          const aState = stateForFrame(scene, a, frame, assets).state;
          const bState = stateForFrame(scene, b, frame, assets).state;
          return Number(aState?.layer ?? 0) - Number(bState?.layer ?? 0);
        })
        .map((entity) => {
          const {state, assetId, activeEvent} = stateForFrame(scene, entity, frame, assets);
          if (!state || state.visible === false || !assetId) return null;
          const asset = assets[assetId];
          const src = asset?.src;
          if (!src) throw new Error(`RENDER_ASSET_MISSING scene=${scene.id} entity=${entity.id} asset=${assetId}`);
          const transform = state.transform ?? {};
          const binding = (scene.spatial_bindings ?? []).find((item) => item.entity === entity.id);
          const relation = binding?.relation;
          const category = asset?.category;
          const role = entity.id.startsWith("env__") || category === "environment"
            ? "environment"
            : category === "character" ? "character"
            : category === "effect" || entity.id === "story_effect" || relation === "emitted_by" ? "effect"
            : category === "prop" || entity.id === "story_prop" || Boolean(binding) ? "prop"
            : "character";
          const focusTargets = new Set([
            entity.id,
            ...(scene.spatial_bindings ?? [])
              .filter((item) => item.anchor === entity.id && (item.relation === "held_by" || item.relation === "emitted_by"))
              .map((item) => item.entity),
          ]);
          // Effects and props react only to their own event, never random actor motion.
          const active = role === "character"
            ? scene.events.find((item) => focusTargets.has(item.target) && frame >= item.start_frame && frame < item.end_frame)
            : activeEvent;
          const before = activeEvent ? entity.states[activeEvent.state_before] : undefined;
          const after = activeEvent ? entity.states[activeEvent.state_after] : undefined;
          const entering = Boolean(before?.visible === false && after?.visible !== false);
          const exiting = Boolean(before?.visible !== false && after?.visible === false);
          const motion = semanticMotionAtFrame(active, frame, {role, entering, exiting});
          const style: React.CSSProperties = {
            position: "absolute",
            left: transform.x ?? 0,
            top: transform.y ?? 0,
            width: transform.width ?? 520,
            height: transform.height ?? 520,
            transform: `translate3d(${motion.dx}px, ${motion.dy}px, 0) scale(${(transform.scale ?? 1) * motion.scale}) rotate(${(transform.rotation ?? 0) + motion.rotate}deg)`,
            opacity: motion.opacity,
            zIndex: state.layer ?? 0,
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
              data-narrative-focus={active && role === "character" ? "active" : "inactive"}
              style={style}
            />
          );        })}

      {caption ? (
        <div
          data-caption="active"
          style={{
            position: "absolute",
            left: safe.x ?? 72,
            top: safe.y ?? 960,
            width: safe.width ?? 936,
            minHeight: safe.height ?? 160,
            maxHeight: safe.height ?? 160,
            overflow: "hidden",
            lineHeight: 1.15,
            overflowWrap: "normal",
            wordBreak: "normal",
            fontFamily: presentation.caption?.font_family ?? "sans-serif",
            fontSize: presentation.caption?.font_size_px ?? 84,
            fontWeight: presentation.caption?.font_weight ?? 400,
            color: presentation.caption?.color ?? presentation.ink ?? "#111111",
            textAlign: "center",
            zIndex: 90,
          }}
        >
          {caption.text}
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
        <SceneLayer scene={scene} assets={assets} presentation={presentation} />
      </Sequence>
    ))}
    <Watermark presentation={presentation} />
  </AbsoluteFill>
  );
};
