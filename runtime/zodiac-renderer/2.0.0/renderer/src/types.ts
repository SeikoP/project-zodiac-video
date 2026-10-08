export type RenderPlanAsset = {
  path?: string;
  src?: string;
  [key: string]: unknown;
};

export type RenderPlanEvent = {
  event_id: string;
  scene_id: string;
  target: string;
  asset_before: string;
  asset_after: string;
  preferred_start_frame?: number;
  start_frame: number;
  end_frame: number;
  state_before: string;
  state_after: string;
  motion: string;
  merged_event_ids?: string[];
};

export type RenderPlanScene = {
  id: string;
  start_frame: number;
  duration_frames: number;
  events: RenderPlanEvent[];
};

export type RendererV2Props = {
  contract: "zodiac-render-plan@1";
  fps: number;
  video: {width: number; height: number};
  assets: Record<string, RenderPlanAsset>;
  scenes: RenderPlanScene[];
};
