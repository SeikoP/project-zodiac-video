import React from "react";
import {AbsoluteFill, Img, Sequence} from "remotion";

import type {RendererV2Props} from "./types";

export const ZodiacRenderPlan: React.FC<RendererV2Props> = ({scenes, assets}) => (
  <AbsoluteFill style={{backgroundColor: "#ffffff"}}>
    {scenes.flatMap((scene) =>
      scene.events.map((event) => (
        <Sequence
          key={event.event_id}
          from={event.start_frame}
          durationInFrames={event.end_frame - event.start_frame}
        >
          <AbsoluteFill
            style={{
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "sans-serif",
              fontSize: 48,
            }}
          >
            {(() => {
              const asset = assets[event.asset_after];
              const src = asset?.src;
              return src ? (
                <Img
                  src={src}
                  data-event-id={event.event_id}
                  data-asset-id={event.asset_after}
                  style={{width: 520, height: 520, objectFit: "contain"}}
                />
              ) : (
                <div data-event-id={event.event_id} data-asset-id={event.asset_after}>
                  {event.target}
                </div>
              );
            })()}
          </AbsoluteFill>
        </Sequence>
      )),
    )}
  </AbsoluteFill>
);
