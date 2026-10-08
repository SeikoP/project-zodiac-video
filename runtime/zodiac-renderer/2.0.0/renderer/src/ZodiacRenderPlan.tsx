import React, {useEffect, useState} from "react";
import {AbsoluteFill, Img, Sequence, useCurrentFrame, delayRender, continueRender, cancelRender} from "remotion";

import type {
  RenderPlanEntity,
  RenderPlanPresentation,
  RenderPlanScene,
  RendererV2Props,
} from "./types";

const useVerifiedCaptionFont = (presentation: RenderPlanPresentation) => {
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

const stateForFrame = (
  scene: RenderPlanScene,
  entity: RenderPlanEntity,
  frame: number,
  assets: RendererV2Props["assets"],
) => {
  let stateId = entity.initial_state;
  let fallbackAsset: string | undefined;

  for (const event of scene.events) {
    if (event.target !== entity.id) continue;
    const transitionDuration = event.end_frame - event.start_frame;
    const resolvedAfterAsset = assets[event.asset_after];
    if (frame >= event.end_frame) {
      stateId = event.state_after;
      fallbackAsset = resolvedAfterAsset ? event.asset_after : fallbackAsset;
    } else if (
      frame >= event.start_frame
      && transitionDuration > 0
      && resolvedAfterAsset
    ) {
      fallbackAsset = event.asset_before;
    }
  }

  const state = entity.states[stateId] ?? entity.states[entity.initial_state];
  return {
    state,
    assetId: state?.asset ?? fallbackAsset,
  };
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
  const safe = captionStyle.safe_zone ?? {};

  return (
    <AbsoluteFill>
      {[...(scene.entities ?? [])]
        .sort((a, b) => {
          const aState = a.states[a.initial_state];
          const bState = b.states[b.initial_state];
          return Number(aState?.layer ?? 0) - Number(bState?.layer ?? 0);
        })
        .map((entity) => {
          const {state, assetId} = stateForFrame(scene, entity, frame, assets);
          if (!state || state.visible === false || !assetId) return null;
          const asset = assets[assetId];
          const src = asset?.src;
          const transform = state.transform ?? {};
          const style: React.CSSProperties = {
            position: "absolute",
            left: transform.x ?? 0,
            top: transform.y ?? 0,
            width: transform.width ?? 520,
            height: transform.height ?? 520,
            transform: `scale(${transform.scale ?? 1}) rotate(${transform.rotation ?? 0}deg)`,
            zIndex: state.layer ?? 0,
            objectFit: "contain",
          };
          return src ? (
            <Img
              key={entity.id}
              src={src}
              data-entity-id={entity.id}
              data-asset-id={assetId}
              style={style}
            />
          ) : (
            <div key={entity.id} data-entity-id={entity.id} style={style}>
              {entity.id}
            </div>
          );
        })}

      {caption ? (
        <div
          data-caption="active"
          style={{
            position: "absolute",
            left: safe.x ?? 72,
            top: safe.y ?? 960,
            width: safe.width ?? 936,
            minHeight: safe.height ?? 160,
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
      }}
    >
      {watermark.text}
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
