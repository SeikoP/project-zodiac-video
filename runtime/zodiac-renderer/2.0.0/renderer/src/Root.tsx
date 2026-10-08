import React from "react";
import {Composition} from "remotion";

import {ZodiacRenderPlan} from "./ZodiacRenderPlan";
import type {RendererV2Props} from "./types";

const defaultProps: RendererV2Props = {
  contract: "zodiac-render-plan@1",
  fps: 24,
  video: {width: 1080, height: 1920},
  assets: {},
  scenes: [{id: "S01", start_frame: 0, duration_frames: 1, events: []}],
};

const duration = (props: RendererV2Props) =>
  Math.max(
    1,
    ...props.scenes.map((scene) => scene.start_frame + scene.duration_frames),
  );

export const Root: React.FC = () => (
  <Composition
    id="ZodiacRenderPlan"
    component={ZodiacRenderPlan}
    durationInFrames={1}
    fps={24}
    width={1080}
    height={1920}
    defaultProps={defaultProps}
    calculateMetadata={({props}) => ({
      durationInFrames: duration(props),
      fps: props.fps,
      width: props.video.width,
      height: props.video.height,
    })}
  />
);
