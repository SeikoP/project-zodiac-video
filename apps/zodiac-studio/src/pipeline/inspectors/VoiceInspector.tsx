import VoiceLab from "../../VoiceLab";
import type { InspectorProps } from "../inspector-registry";

export default function VoiceInspector({ project, active, onChanged }: InspectorProps) {
  return <VoiceLab project={project} active={active} onChanged={onChanged} />;
}
