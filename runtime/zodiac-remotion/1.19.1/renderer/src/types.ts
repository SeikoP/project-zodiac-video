import type {Caption} from "@remotion/captions";

export type Transform = {x: number; y: number; width: number; height: number};
export type PrimitiveElement = {tag: string; attributes: Record<string, string | number>};
export type Primitive = {kind: "svg_elements"; viewBox: string; elements: PrimitiveElement[]};
export type AssetLineage = {
  mode: "direct_copy" | "derived_copy" | "semantic_variant" | "composite";
  source_library: "zodiac-paper-doodle-asset-library-v3";
  source_master: string | string[];
  semantic_intent: string;
  mutated_groups?: string[];
  preserved_groups?: string[];
};
export type ProductionAsset = {
  kind: "svg";
  category: string;
  character_id?: string;
  pose: string;
  path: string;
  format: "image/svg+xml";
  style_id: string;
  lineage: AssetLineage;
};
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
export type Performance = {
  intent: string;
  phase: "anticipation" | "action" | "reaction" | "hold" | "settle";
  energy: number;
  focus?: string;
  anticipation_frames: number;
  hold_frames: number;
  settle_frames: number;
  cause_event_id?: string;
};
export type EventMechanism =
  | {mode: "child_entities"; parts: string[]; justification?: never}
  | {mode: "whole_asset"; parts?: never; justification: string};
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
  performance: Performance;
  sfx?: string;
  mechanism?: EventMechanism;
};
export type ProductionScene = {
  id: string;
  voice: string;
  timing: {mode: "from_voice"};
  entities: VisualEntity[];
  events: VisualEvent[];
  transition: {type: string; duration_frames: number};
  captions: {source: "voice"; segmentation: "semantic"; max_lines: number; page_target_words?: number; max_words?: number};
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
