import React from "react";
import {AbsoluteFill, Sequence} from "remotion";

import type {RendererV2Props} from "./types";

export const ZodiacRenderPlan: React.FC<RendererV2Props> = ({scenes}) => (
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
            <div data-event-id={event.event_id} data-asset-id={event.asset_after}>
              {event.target}
            </div>
          </AbsoluteFill>
        </Sequence>
      )),
    )}
  </AbsoluteFill>
);
