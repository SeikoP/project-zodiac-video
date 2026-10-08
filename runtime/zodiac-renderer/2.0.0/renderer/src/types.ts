export type RenderPlanAsset = {
  path?: string;
  src?: string;
  [key: string]: unknown;
};

export type RenderTransform = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  scale?: number;
  rotation?: number;
};

export type RenderPlanState = {
  asset: string;
  transform?: RenderTransform;
  layer?: number;
  visible?: boolean;
  [key: string]: unknown;
};

export type RenderPlanEntity = {
  id: string;
  initial_state: string;
  states: Record<string, RenderPlanState>;
};

export type RenderPlanCaption = {
  text: string;
  start_frame: number;
  end_frame: number;
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

export type RenderBox = {x: number; y: number; width: number; height: number};
export type RenderLayoutContract = {canvas: {width: number; height: number}; caption_safe_zone: RenderBox; character_zone: RenderBox; prop_zone: RenderBox; effect_zone: RenderBox};

export type RenderPlanScene = {
  id: string;
  continuity_group?: string;
  performance_context_hash?: string;
  start_frame: number;
  duration_frames: number;
  measured_duration_frames?: number;
  entities?: RenderPlanEntity[];
  layout_contract?: RenderLayoutContract;
  captions?: RenderPlanCaption[];
  events: RenderPlanEvent[];
};

export type RenderPlanPresentation = {
  paper?: string;
  ink?: string;
  caption?: {
    font_family?: string;
    font_data_uri?: string;
    font_size_px?: number;
    font_weight?: number;
    max_lines?: number;
    color?: string;
    highlight_color?: string;
    safe_zone?: {x?: number; y?: number; width?: number; height?: number};
  };
  watermark?: {
    enabled?: boolean;
    text?: string;
    anchor?: string;
    offset_px?: {x?: number; y?: number};
    font_family?: string;
    font_size_px?: number;
    font_weight?: number;
    opacity?: number;
    layer?: number;
  };
};

export type CoverPublish = {cover?: {source_scene_id: string; identity: {label: string; glyph: string}; hook: string; visuals: Array<{entity_id: string; state_id: string; transform?: RenderTransform}>}; [key: string]: unknown};

export type RendererV2Props = {
  publish?: CoverPublish;
  contract: "zodiac-render-plan@1";
  fps: number;
  video: {width: number; height: number};
  presentation?: RenderPlanPresentation;
  performance_context_hash?: string;
  assets: Record<string, RenderPlanAsset>;
  scenes: RenderPlanScene[];
};
