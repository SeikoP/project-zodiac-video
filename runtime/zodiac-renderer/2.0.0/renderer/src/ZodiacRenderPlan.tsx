import React, {useEffect, useState} from "react";
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
  let blend: {fromAsset: string; progress: number} | undefined;
  for (const event of [...scene.events].filter((e) => e.target === entity.id).sort(
    (a, b) => a.end_frame - b.end_frame,
  )) {
    if (frame >= event.end_frame) {
      stateId = event.state_after;
      // Runtime resolves the exact authored after-asset, rather than inventing one.
      lastResolvedAfterAsset = assets[event.asset_after] ? event.asset_after : undefined;
    } else {
      break;
    }
    const before = entity.states[event.state_before]?.asset ?? event.asset_before;
    const after = entity.states[event.state_after]?.asset ?? event.asset_after;
    const frames = Math.min(5, Math.max(1, event.end_frame - event.start_frame));
    if (frame < event.end_frame + frames && before !== after && assets[before]) {
      blend = {fromAsset: before, progress: Math.min(1, (frame - event.end_frame + 1) / frames)};
    } else {
      blend = undefined;
    }
  }
  const state = entity.states[stateId] ?? entity.states[entity.initial_state];
  return {state, assetId: state?.asset ?? lastResolvedAfterAsset, blend};
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
          const {state, assetId} = stateForFrame(scene, entity, frame, assets);
          if (!state || state.visible === false || !assetId) return null;
          const asset = assets[assetId];
          const src = asset?.src;
          if (!src) throw new Error(`RENDER_ASSET_MISSING scene=${scene.id} entity=${entity.id} asset=${assetId}`);
          const transform = state.transform ?? {};
          const binding = (scene.spatial_bindings ?? []).find((item) => item.entity === entity.id);
          const relation = binding?.relation;
          const role = entity.id === "story_effect" || relation === "emitted_by"
            ? "effect"
            : entity.id === "story_prop" || Boolean(binding)
            ? "prop"
            : "other";
          // Job@5 already resolves voice anchors to event frames. Only animate the
          // explicitly authored event target: never guess narrative focus from text.
          const focusTargets = new Set([
            entity.id,
            ...(scene.spatial_bindings ?? [])
              .filter((item) => item.anchor === entity.id && (item.relation === "held_by" || item.relation === "emitted_by"))
              .map((item) => item.entity),
          ]);
          const active = scene.events.find(
            (item) => focusTargets.has(item.target) && frame >= item.start_frame && frame < item.end_frame,
          );
          const local = active ? frame - active.start_frame : 0;
          const structural = entity.id.startsWith("env__");
          const character = !structural && role === "other";
          // Ease-in/out pulse, zero at BOTH event boundaries: no unrelated idle
          // bobbing and no unexplained drift from authored spatial coordinates.
          const phase = active
            ? Math.min(1, Math.max(0, (frame - active.start_frame) / Math.max(1, active.end_frame - active.start_frame)))
            : 0;
          const focusEnvelope = active ? Math.sin(Math.PI * phase) ** 2 : 0;
          const focusScale = character ? 1 + 0.012 * focusEnvelope : 1;
          const focusRotate = character ? 1.3 * focusEnvelope : 0;
          const effectPulse = role === "effect" ? 1 + 0.055 * focusEnvelope : 1;
          const fraction = Math.min(1, Math.max(0, (active ? local : relativeFrame) / (role === "effect" ? 9 : 7)));
          const eased = 1 - Math.pow(1 - fraction, 3);
          const revealScale = role === "effect" ? 0.94 + 0.06 * eased : role === "prop" ? 0.97 + 0.03 * eased : 1;
          const revealOpacity = role === "effect" ? eased : role === "prop" ? 0.4 + 0.6 * eased : 1;
          const style: React.CSSProperties = {
            position: "absolute",
            left: transform.x ?? 0,
            top: transform.y ?? 0,
            width: transform.width ?? 520,
            height: transform.height ?? 520,
            transform: `scale(${(transform.scale ?? 1) * revealScale * focusScale * effectPulse}) rotate(${(transform.rotation ?? 0) + focusRotate}deg)`,
            opacity: revealOpacity,
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
              data-narrative-focus={active && character ? "active" : "inactive"}
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
