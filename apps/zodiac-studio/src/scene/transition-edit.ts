import type { VisualIntent } from "../backend";

export type TransitionPreset = "cut" | "paper-slide" | "page-turn";
export type Transition = { preset: TransitionPreset; frames: number };

/** Mirrors tools/studio_project/transitions.json (the compiler is the authority and re-validates). */
export const TRANSITION_PRESETS: Record<TransitionPreset, { label: string; min: number; max: number }> = {
  "cut": { label: "Cắt thẳng", min: 0, max: 0 },
  "paper-slide": { label: "Trượt giấy", min: 6, max: 18 },
  "page-turn": { label: "Lật trang", min: 9, max: 24 },
};

export const transitionLabel = (preset: TransitionPreset | undefined) => preset ? TRANSITION_PRESETS[preset].label : `${TRANSITION_PRESETS["page-turn"].label} (mặc định)`;

const clamp = (t: Transition): Transition => {
  const spec = TRANSITION_PRESETS[t.preset];
  return { preset: t.preset, frames: Math.max(spec.min, Math.min(spec.max, Math.round(t.frames))) };
};

/** The intent with one scene's transition (the boundary AFTER that scene) replaced; the input is not modified. */
export function withTransition(intent: VisualIntent, sceneId: string, transition: Transition): VisualIntent {
  if (!intent.scenes.some((s) => s.id === sceneId)) throw new Error(`Không có cảnh ${sceneId}`);
  return { ...intent, scenes: intent.scenes.map((s) => (s.id === sceneId ? { ...s, transition: clamp(transition) } : s)) };
}

/** Same transition after every scene except the last (it has no next scene). */
export function withTransitionEverywhere(intent: VisualIntent, transition: Transition): VisualIntent {
  const last = intent.scenes.length - 1;
  return { ...intent, scenes: intent.scenes.map((s, i) => (i === last ? s : { ...s, transition: clamp(transition) })) };
}
