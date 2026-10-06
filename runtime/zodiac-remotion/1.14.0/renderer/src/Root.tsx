import {Composition, Still, type CalculateMetadataFunction} from "remotion";
import {ZodiacComposition} from "./ZodiacComposition";
import {ZodiacCover} from "./ZodiacCover";
import type {Production, RenderProps} from "./types";

const defaultProps: RenderProps = {
  fps: 30,
  total_duration_frames: 1,
  scenes: [],
  resolved_events: {},
  production: {} as Production,
  publish: null,
};

const calculateMetadata: CalculateMetadataFunction<RenderProps> = ({props}) => {
  const production = props.production;
  if (!production?.video) throw new Error("Render props must include production.");
  if (!Number.isInteger(props.total_duration_frames) || props.total_duration_frames < 1) {
    throw new Error("Runtime timing must provide measured total_duration_frames.");
  }
  if (props.fps !== production.video.fps) throw new Error("Runtime timing fps must match production.json.");
  if (!props.resolved_events || Object.keys(props.resolved_events).length === 0) {
    throw new Error("Measured event anchors must be resolved by scripts/render.mjs before rendering.");
  }
  return {durationInFrames: props.total_duration_frames, width: production.video.width, height: production.video.height, fps: production.video.fps};
};

export const RemotionRoot = () => <>
  <Composition id="ZodiacVideo" component={ZodiacComposition} durationInFrames={1} width={1080} height={1920} fps={30} defaultProps={defaultProps} calculateMetadata={calculateMetadata} />
  <Still id="ZodiacCover" component={ZodiacCover} width={1080} height={1920} defaultProps={defaultProps} />
</>;
