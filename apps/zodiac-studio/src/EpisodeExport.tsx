import { useEffect, useState } from "react";
import { backend, type Project, type VideoExport, type VisualState } from "./backend";
import VideoReview from "./VideoReview";

export default function EpisodeExport({ project, initialConceptId, active }: { project: Project | null; initialConceptId: string; active: boolean }) {
  const [state, setState] = useState<VisualState | null>(null);
  const [video, setVideo] = useState<VideoExport | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!project || !active) return;
    let live = true;
    let videoIdentity = "";
    let pending = false;
    const refresh = async () => {
      if (pending || !live) return;
      pending = true;
      try {
        const next = await backend.visualOpen(project.project_id);
        if (!live) return;
        setState(next);
        const identity = next.export ? [next.export.id, next.revision, next.build?.id, next.stale_preview].join(":") : "";
        if (identity && identity !== videoIdentity) {
          const output = await backend.video(project.project_id);
          if (live) { setVideo(output); videoIdentity = identity; }
        } else if (!identity) { setVideo(null); videoIdentity = ""; }
      } catch (e) { if (live) setError(String(e)); }
      finally { pending = false; }
    };
    void refresh(); const timer = window.setInterval(() => void refresh(), 1500);
    return () => { live = false; window.clearInterval(timer); };
  }, [project?.project_id, active]);
  const running = state?.job?.status === "RUNNING";
  return <section className="episode-export">
    <div className="export-controls"><strong>Xuất & duyệt</strong>
      <button className="primary-btn" disabled={!project || busy || running || !state?.build || state.stale_preview} onClick={async () => {
        if (!project || !state) return;
        setBusy(true); setError("");
        try { setState(await backend.exportVideo(project.project_id, state.revision)); }
        catch (e) { setError(String(e)); } finally { setBusy(false); }
      }}>Xuất MP4</button>
      {running && <button className="outline-btn" onClick={() => project && void backend.visualCancel(project.project_id).then(setState).catch(e => setError(String(e)))}>Dừng tác vụ</button>}
      <small>{state?.stale_preview ? "Hình ảnh đã đổi: dựng lại ở tab Hình ảnh." : !state?.build ? "Dựng hình ảnh trước khi xuất." : "Xuất video không tự duyệt chất lượng."}</small>
    </div>
    {error && <div className="inline-alert error" role="alert">{error}</div>}
    {state?.job && <div className="review-message" role="status">{state.job.message} · {state.job.status}{state.job.render_percent === undefined ? "" : ` · ${state.job.render_percent}%`}{state.job.error && ` · ${state.job.error}`}</div>}
    <VideoReview initialConceptId={initialConceptId} output={video} active={active}/>
    {video && <div className="export-path"><small>{video.file_path} · {video.stale ? "Nguồn đã thay đổi" : "Đúng bản xuất hiện tại"}</small>
      <button className="subtle-btn" onClick={() => void navigator.clipboard.writeText(video.file_path ?? "").catch(e => setError(String(e)))}>Copy đường dẫn MP4</button>
      <details><summary>Receipt & tệp kèm</summary><small>SHA-256: {video.sha256}</small><small>MP4, captions.srt, cover.png và receipt được lưu cùng thư mục export.</small></details></div>}
  </section>;
}
