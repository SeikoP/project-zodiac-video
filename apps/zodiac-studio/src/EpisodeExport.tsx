import { useEffect, useState } from "react";
import { backend, type Project, type VideoExport, type VisualState } from "./backend";
import type { PipelineEvidence } from "./pipeline/types";
import VideoReview from "./VideoReview";

/** One plain sentence per job state: the raw renderer log line and status code mean nothing to the person using the app. */
function jobText(job: NonNullable<VisualState["job"]>) {
  const percent = job.render_percent === undefined ? "" : ` · ${job.render_percent}%`;
  if (job.status === "RUNNING") return `Đang xuất MP4${percent}. ${job.message}`;
  if (job.status === "COMPLETED") return "Lần xuất gần nhất đã xong.";
  if (job.status === "INTERRUPTED") return "Lần xuất trước bị ngắt (Studio khởi động lại); bản MP4 tốt gần nhất vẫn được giữ.";
  if (job.status === "CANCELLED") return "Lần xuất đã bị dừng.";
  return `${job.message}${job.error ? ` · ${job.error}` : ""} · ${job.status}`;
}

export default function EpisodeExport({ project, initialConceptId, active }: { project: Project | null; initialConceptId: string; active: boolean }) {
  const [state, setState] = useState<VisualState | null>(null);
  const [video, setVideo] = useState<VideoExport | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [publish, setPublish] = useState<PipelineEvidence["publish"]>(null);
  const [copied, setCopied] = useState("");
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
  useEffect(() => {
    if (!project || !active) return;
    let live = true;
    backend.pipelineEvidence(project.project_id).then(e => { if (live) setPublish(e.publish); }).catch(() => { if (live) setPublish(null); });
    return () => { live = false; };
  }, [project?.project_id, active, video?.id]);
  const copy = (label: string, text: string) => void navigator.clipboard.writeText(text).then(() => { setCopied(label); window.setTimeout(() => setCopied(""), 1800); }).catch(e => setError(String(e)));
  const tags = (publish?.hashtags ?? []).join(" ");
  const running = state?.job?.status === "RUNNING";
  const current = !!(state?.export && video && !video.stale); // an MP4 for exactly the current source already exists
  return <section className="episode-export">
    <div className="export-controls"><strong>Xuất & duyệt</strong>
      <button className={current ? "outline-btn" : "primary-btn"} disabled={!project || busy || running || !state?.build || state.stale_preview} onClick={async () => {
        if (!project || !state) return;
        setBusy(true); setError("");
        try { setState(await backend.exportVideo(project.project_id, state.revision)); }
        catch (e) { setError(String(e)); } finally { setBusy(false); }
      }}>{current ? "Xuất lại MP4" : "Xuất MP4"}</button>
      {running && <button className="outline-btn" onClick={() => project && void backend.visualCancel(project.project_id).then(setState).catch(e => setError(String(e)))}>Dừng tác vụ</button>}
      <small>{state?.stale_preview ? "Hình ảnh đã đổi: chọn Hình ảnh trong Graph và dựng lại." : !state?.build ? "Dựng hình ảnh trước khi xuất." : current ? "Đã có MP4 đúng bản hiện tại. Chỉ bấm Xuất lại khi muốn render lại." : "Xuất video không tự duyệt chất lượng."}</small>
    </div>
    {error && <div className="inline-alert error" role="alert">{error}</div>}
    {state?.job && <div className="review-message" role="status">{jobText(state.job)}</div>}
    <VideoReview initialConceptId={project?.concept_code || initialConceptId} lockedSign={project?.sign ?? null} output={video} active={active}/>
    {publish && <div className="publish-copy" aria-label="Nội dung đăng">
      <div className="publish-copy-head"><strong>Nội dung đăng</strong>{copied && <small role="status">Đã copy {copied}</small>}
        <button className="subtle-btn" onClick={() => copy("tất cả", [publish.title, publish.description, tags].filter(Boolean).join("\n\n"))}>Copy tất cả</button></div>
      {publish.title && <div className="publish-row"><span>{publish.title}</span><button className="subtle-btn" onClick={() => copy("tiêu đề", publish.title ?? "")}>Copy tiêu đề</button></div>}
      {publish.description && <div className="publish-row"><span>{publish.description}</span><button className="subtle-btn" onClick={() => copy("mô tả", publish.description ?? "")}>Copy mô tả</button></div>}
      {tags && <div className="publish-row"><span>{tags}</span><button className="subtle-btn" onClick={() => copy("hashtag", tags)}>Copy hashtag</button></div>}
    </div>}
    {video && <div className="export-path"><small>{video.file_path} · {video.stale ? "Nguồn đã thay đổi" : "Đúng bản xuất hiện tại"}</small>
      <small>{video.audio_contract ? `Giọng đã chọn · Nhạc nền: ${video.audio_contract.music_tracks} · SFX: ${video.audio_contract.sfx_tracks}${video.audio_contract.sfx_cues === undefined ? "" : ` (${video.audio_contract.sfx_cues} chuyển cảnh)`}` : "Gói cũ: chưa xác minh hợp đồng âm thanh"}</small>
      <small>{video.cover?.source_frame === 0 && video.cover_contract?.mode === "series-topic-opening@1"
        ? `Cover series: ${video.cover_contract.opening?.topic ?? "Chủ đề tập"} · frame đầu MP4`
        : video.cover?.source_frame === 0 && video.cover_contract?.mode === "first-encoded-video-frame@1"
          ? "Cover: lấy đúng frame đầu MP4" : "Cover: chưa xác minh nguồn khung hình"}</small>
      <button className="subtle-btn" onClick={() => void navigator.clipboard.writeText(video.file_path ?? "").catch(e => setError(String(e)))}>Copy đường dẫn MP4</button>
      <details><summary>Receipt & tệp kèm</summary><small>SHA-256: {video.sha256}</small><small>MP4, captions.srt, cover.png và receipt được lưu cùng thư mục export.</small></details></div>}
  </section>;
}
