import type {Caption} from "@remotion/captions";
import type {Production, ProductionScene} from "./types";

export function segmentCaptionWords(
  words: Caption[],
  options: {maxLines?: number; maxWidth: number; measure: (text: string) => number},
): Array<{words: Caption[]; lines: string[]; startMs: number; endMs: number}>;
export function resolveVoiceAnchor(anchorText: string, words: Caption[], occurrence?: number): {startMs: number; endMs: number};
export function resolveProductionEvents(production: Production, timing: {fps: number; scenes: Array<{scene_id: string; start_frame: number; duration_frames: number; captions: Caption[]}>}): Record<string, number>;
export function validateEventStates(scene: ProductionScene): void;

export function validateVisualProgression(
  scene: ProductionScene,
  timingRow: {scene_id: string; start_frame: number; duration_frames: number},
  resolvedEvents: Record<string, number>,
  fps: number,
  maxGapSeconds?: number,
): void;
export function validateNarrationProgressionProxy(scene: ProductionScene, maxGapWords?: number): void;
