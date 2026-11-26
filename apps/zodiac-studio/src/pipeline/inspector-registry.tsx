import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { Project } from "../backend";
import type { PipelineNode } from "./types";

export type InspectorProps = {
  project: Project | null;
  node: PipelineNode;
  active: boolean;
  initialConceptId: string;
  /** Re-read pipeline and project state after the inspector changed something. */
  onChanged: () => void;
  onImport: () => void;
  blockedBy?: string[];
};
export type Inspector = LazyExoticComponent<ComponentType<InspectorProps>>;

const Voice = lazy(() => import("./inspectors/VoiceInspector"));
const Generic = lazy(() => import("./inspectors/GenericInspector"));

/**
 * The extension point: one inspector per node id (fan instances use their spec id, e.g. `scene`).
 * `null` means the Visual Editor's own scene inspector is the right panel. Unknown ids fall back
 * to the generic panel, so adding a node to nodes.json never breaks the shell.
 */
export const INSPECTORS: Record<string, Inspector | null> = {
  content: lazy(() => import("./inspectors/ContentInspector")),
  voice: Voice,
  voice_review: Voice,
  timing: Voice,
  visual: null, // the Visual Editor's own inspector hosts authoring (Trợ lý dựng hình) and scene editing
  checks: Generic,
  assets: Generic,
  cover: Generic,
  publish: Generic,
  scene: null,
  build: Generic,
  inspect: Generic,
  visual_review: lazy(() => import("./inspectors/ReviewInspector")),
  export: lazy(() => import("./inspectors/ExportInspector")),
};

export const FALLBACK_INSPECTOR: Inspector = Generic;

export const inspectorKey = (node: PipelineNode) => node.id.split(":")[0];

export function inspectorFor(node: PipelineNode): Inspector | null {
  const key = inspectorKey(node);
  return key in INSPECTORS ? INSPECTORS[key] : FALLBACK_INSPECTOR;
}
