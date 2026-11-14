/** P1 HyperFrames package/API smoke in the single Tauri window.
 *  Explicitly read-only. Canonical Visual Intent adapter is Phase 4, and no
 *  StudioApp/EditorShell mutations are permitted before that contract exists.
 */
import { HyperframesLogo } from "@hyperframes/studio/ui";
import { Lock, Layers3, ShieldCheck, Film } from "lucide-react";
import type { Project } from "./backend";

export default function HyperframesWorkspace({ project }: { project: Project | null }) {
  return <section className="hyperframes-workspace">
    <div className="hf-head">
      <span className="hf-brand"><HyperframesLogo/> <strong>Visual Workspace</strong></span>
      <span className="status-chip status-neutral"><Lock size={12}/> Read-only skeleton</span>
    </div>
    <div className="hf-layout">
      <div className="hf-files">
        <h3><Layers3 size={15}/> Project files</h3>
        <div className="hf-filetree-empty">Chưa có scene manifest</div>
        <p>Chưa có Scene Visual Intent nào được xác minh để đưa vào HyperFrames.</p>
      </div>
      <div className="hf-stage">
        <div className="hf-viewport">
          <span className="hf-watermark">✦</span>
          <Film size={36} strokeWidth={1.2}/>
          <span>9:16 · 1080 × 1920</span>
          <small>{project ? project.display_title || project.episode_id : "Chọn một episode"}</small>
          <p>Scene preview xuất hiện sau khi compiler V5 cung cấp manifest có xác thực.</p>
        </div>
      </div>
      <aside className="hf-inspector">
        <h3>Inspector</h3>
        <div><strong>Ownership</strong><small>Visual Intent · Python/Node canonical</small></div>
        <div><strong>Source</strong><small>{project ? project.source_sha256.slice(0, 16) + "…" : "No episode"}</small></div>
        <div><strong>Edit authority</strong><small>Disabled until Phase 4</small></div>
        <div className="hf-protection"><ShieldCheck size={17}/> Không chỉnh sửa narration/approval</div>
      </aside>
    </div>
    <div className="hf-timeline"><span>00:00</span>
      <div><span className="hf-playhead"/></div>
      <span>Scene data pending</span>
    </div>
  </section>;
}
