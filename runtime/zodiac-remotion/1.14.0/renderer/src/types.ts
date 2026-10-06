import type {Caption} from "@remotion/captions";

export type Transform = {x: number; y: number; width: number; height: number};
export type PrimitiveElement = {tag: string; attributes: Record<string, string | number>};
export type Primitive = {kind: "svg_elements"; viewBox: string; elements: PrimitiveElement[]};
export type ProductionAsset = {kind: "svg"; category: string; character_id?: string; pose: string; path: string; format: "image/svg+xml"; style_id: string};
export type VisualState = {
  asset?: string;
  primitive?: string;
  transform: Transform;
  layer: number;
  visible: boolean;
};
export type VisualEntity = {
  id: string;
  kind: "character" | "object";
  initial_state: string;
  states: Record<string, VisualState>;
};
export type Motion = {preset: string; duration_frames: number};
export type Trigger =
  | {source: "scene_start"}
  | {source: "voice_anchor"; text: string; occurrence?: number};
export type VisualEvent = {
  id: string;
  target: string | "camera";
  action: string;
  state_before: string;
  state_after: string;
  trigger: Trigger;
  motion: Motion;
  sfx?: string;
};
export type ProductionScene = {
  id: string;
  voice: string;
  timing: {mode: "from_voice"};
  entities: VisualEntity[];
  events: VisualEvent[];
  transition: {type: string; duration_frames: number};
  captions: {source: "voice"; page_target_words: number; max_words: number; max_lines: number};
};
export type Production = {
  version: "2.0";
  video: {width: 1080; height: 1920; fps: number};
  visual_system: {
    palette: Record<string, string>;
    background_primitive: string;
    primitive_renderer: {allowed_tags: string[]};
    motion_presets: Record<string, {keyframes: Array<Record<string, number | string>>; easing: string}>;
    transition_presets: Record<string, {renderer: string; axis?: string; direction?: string}>;
    sfx_profiles: Record<string, Record<string, number | string>>;
    style_token: Record<string, unknown>;
  };
  caption_style: {
    font_family: "Patrick Hand";
    font_size_px: number;
    min_font_size_px: number;
    font_weight: number;
    color: string;
    highlight_color: string;
    background: string;
    safe_area: {x: number; y: number; width: number; height: number};
    max_lines: number;
  };
  primitives: Record<string, Primitive>;
  assets: Record<string, ProductionAsset>;
  scenes: ProductionScene[];
};
export type RuntimeSceneTiming = {
  scene_id: string;
  start_frame: number;
  duration_frames: number;
  captions: Caption[];
};
export type RuntimeTiming = {
  fps: number;
  total_duration_frames: number;
  scenes: RuntimeSceneTiming[];
  resolved_events?: Record<string, number>;
};

export type PublishDocument = {
  cover: {
    layout: string;
    identity: {sign_id: string; label: string; glyph: string};
    hook: string;
    source_scene_id: string;
    visuals: Array<{entity_id: string; state_id: string; transform?: Transform}>;
  };
  caption: string;
  hashtags: string[];
};
export type RenderProps = RuntimeTiming & {production: Production; publish: PublishDocument | null};
