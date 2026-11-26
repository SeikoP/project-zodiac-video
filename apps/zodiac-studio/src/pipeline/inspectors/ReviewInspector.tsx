import { useCallback, useEffect, useRef, useState } from "react";
import { backend } from "../../backend";
import EpisodePlayer from "../../EpisodePlayer";
import type { InspectorProps } from "../inspector-registry";
import { useEvidence } from "./useEvidence";

/** The review player and the user-only gate stay together, independently of editor overlays. */
export default function ReviewInspector({ project, node, active, blockedBy = [], onChanged }: InspectorProps) {
  const { evidence, error: loadError } = useEvidence(project?.project_id, node.status);
  const [playback, setPlayback] = useState<string | null>(null);
  const [watching, setWatching] = useState(false), [busy, setBusy] = useState(false);
  const [media, setMedia] = useState<{ audioUrl: string; durationMs: number } | null>(null);
  const [remaining, setRemaining] = useState(10), [error, setError] = useState("");
  const requested = useRef(false);
  // A stale approval (the build changed after it) is reviewed again like a new one, as long as every earlier step is done.
  const renew = node.status === "STALE" && blockedBy.length === 0;
  const ready = node.status === "AWAITING_USER" || renew, done = node.status === "DONE";
  const buildId = evidence?.build_id ?? null;
  const report = useCallback((reason: unknown) => {
    setError(reason instanceof Error ? reason.message : String(reason));
    setWatching(false); setPlayback(null); requested.current = false;
  }, []);

  useEffect(() => {
    if (!watching || !active || !project || !buildId) return;
    let live = true;
    setMedia(null);
    void Promise.all([backend.visualOpen(project.project_id), backend.voiceOpen(project.project_id)]).then(async ([visual, voice]) => {
      if (visual.build?.id !== buildId || visual.stale_preview) throw Error("Bản dựng đã thay đổi; mở lại phần duyệt.");
      if (!voice.assembly || voice.assembly.valid === false || voice.assembly.wav_sha256 !== visual.build.voice_sha256) throw Error("Giọng đọc đã thay đổi; dựng lại video trước khi duyệt.");
      const mix = await backend.audioPreview(project.project_id, buildId);
      if (!live) return;
      setMedia({ audioUrl: mix.url, durationMs: Math.max(...visual.build.scenes.map(s => s.end_ms)) });
    }).catch(reason => { if (live) report(reason); });
    return () => { live = false; };
  }, [watching, active, project?.project_id, buildId, report]);

  useEffect(() => {
    if (!playback) { setRemaining(10); return; }
    const opened = Date.now();
    const timer = window.setInterval(() => setRemaining(Math.max(0, Math.ceil(10 - (Date.now() - opened) / 1000))), 250);
    return () => window.clearInterval(timer);
  }, [playback]);

  const started = useCallback(() => {
    if (requested.current || !ready || !project || !buildId) return;
    requested.current = true;
    void backend.pipelinePlayback(project.project_id, buildId).then(result => setPlayback(result.playback_id)).catch(report);
  }, [ready, project?.project_id, buildId, report]);

  const confirm = async () => {
    if (!project || !buildId || !playback || evidence?.revision == null) return;
    setBusy(true); setError("");
    try {
      await backend.pipelineConfirmVisual(project.project_id, evidence.revision, buildId, playback);
      setPlayback(null); setWatching(false); onChanged();
    } catch (reason) { report(reason); } finally { setBusy(false); }
  };

  return <div className="source-context review-inspector">
    <div className="review-preview">
      {watching && active && media && project && buildId
        ? <EpisodePlayer projectId={project.project_id} buildId={buildId} audioUrl={media.audioUrl}
            durationMs={media.durationMs} onError={report} autoplay onPlaybackStart={started}/>
        : <div className="review-placeholder"><strong>Xem cả video để duyệt hình ảnh</strong><p>{watching ? "Đang chuẩn bị hình ảnh và giọng đọc…" : "Bản dựng và phần duyệt sẽ hiện cạnh nhau tại đây."}</p></div>}
    </div>
    <div className="review-controls">
      <h2>Duyệt hình ảnh</h2>
      {renew && <p role="status">Bản dựng đã đổi sau lần duyệt trước. Xem lại và duyệt lại bản mới.</p>}
      {done && <p role="status">Đã duyệt bản dựng này. Sửa nguồn hoặc dựng lại sẽ cần duyệt lại.</p>}
      {!ready && !done && <p role="status">Chưa thể duyệt. {blockedBy.length ? `Cần hoàn tất: ${blockedBy.join(", ")}.` : node.detail || "Đang chờ bản dựng và kết quả kiểm tra."}</p>}
      {(ready || done) && <>
        <p>Xem diễn xuất, chữ và chuyển cảnh trong toàn bộ video, rồi xác nhận bên dưới.</p>
        {!watching && <button className="outline-btn" disabled={!buildId || busy} onClick={() => { setError(""); setWatching(true); }}>Bắt đầu xem bản dựng</button>}
      </>}
      {ready && <>
        <p role="status">{playback ? remaining > 0 ? `Đang xem · có thể duyệt sau ${remaining} giây.` : "Nếu đã xem và đồng ý với hình ảnh, bạn có thể duyệt." : "Chưa ghi nhận phát bản dựng."}</p>
        <button className="primary-btn" disabled={busy || !playback || remaining > 0 || evidence?.revision == null} onClick={() => void confirm()}>Duyệt hình ảnh</button>
      </>}
      {(error || loadError) && <p role="alert" className="pipe-error">{error || loadError}</p>}
      <details className="review-evidence"><summary>Kết quả kiểm tra và nội dung đăng</summary>
        <ul>
          <li>Kiểm tra bản soạn: {evidence?.checks ? evidence.checks.ok ? "đạt" : `${evidence.checks.issues.length} vấn đề` : "chưa có"}</li>
          <li>Kiểm khung hình: {evidence?.inspect ? `${evidence.inspect.findings.length} nhận xét (${evidence.inspect.method === "visual" ? "nhìn khung hình" : "cấu trúc"})` : "chưa có"}</li>
          <li>Ảnh bìa: {evidence?.cover?.headline ?? "chưa có"}</li>
          <li>Nội dung đăng: {evidence?.publish?.title ?? "chưa có"}</li>
        </ul>
      </details>
    </div>
  </div>;
}
