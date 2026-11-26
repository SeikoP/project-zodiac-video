import EpisodeExport from "../../EpisodeExport";
import type { InspectorProps } from "../inspector-registry";

export default function ExportInspector({ project, active, initialConceptId }: InspectorProps) {
  return <EpisodeExport project={project} active={active} initialConceptId={initialConceptId} />;
}
