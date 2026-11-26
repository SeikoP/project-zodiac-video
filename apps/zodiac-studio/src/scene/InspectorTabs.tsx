import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import AgentProposal from "../AgentProposal";
import { Paged } from "../Paged";
import { TRANSITION_PRESETS, transitionLabel, type Transition, type TransitionPreset } from "./transition-edit";
import type { AgentHealth, AgentTask, CandidateResult, GalleryAsset, VisualEntity, VisualScene, VisualTransform } from "../backend";

/** The four tabs of the scene inspector. They own no state: the editor passes values and callbacks. */

type SourceMapRow = { entity_id: string; state_id: string; hf_id: string; asset_id?: string; source_sha256: string };
const BUSY = ["STARTING", "RUNNING"];

export function ObjectTab({ scene, entity, stateId, selectedAsset, mapped, draft, disabled, sdkReady, onEntity, onState, onDraft, onCommit }: {
  scene: VisualScene | undefined; entity: VisualEntity | undefined; stateId: string | undefined; selectedAsset: string | undefined; mapped: SourceMapRow | undefined;
  draft: VisualTransform | null; disabled: boolean; sdkReady: boolean;
  onEntity: (id: string) => void; onState: (id: string) => void; onDraft: (next: VisualTransform) => void; onCommit: (value: VisualTransform) => void;
}) {
  return (
    <div className="inspector-group">
      <label>Đối tượng<select aria-label="Đối tượng" value={entity?.id ?? ""} onChange={(e) => onEntity(e.target.value)}>{scene?.entities.map((e) => <option key={e.id} value={e.id}>{e.id} · {e.kind}</option>)}</select></label>
      <label>Trạng thái<select aria-label="Trạng thái" value={stateId ?? ""} onChange={(e) => onState(e.target.value)}>{Object.keys(entity?.states ?? {}).map((id) => <option key={id}>{id}</option>)}</select></label>
      {draft && <><div className="visual-transform">{(["x", "y", "width", "height", "rotation"] as const).map((key) => (
        <label key={key}>{{ x: "Vị trí ngang", y: "Vị trí dọc", width: "Chiều rộng", height: "Chiều cao", rotation: "Góc xoay" }[key]}
          <input type="number" value={draft[key] ?? 0} disabled={disabled} onChange={(e) => onDraft({ ...draft, [key]: Number(e.target.value) })} /></label>))}</div>
        <button className="primary-btn" disabled={disabled || !sdkReady} onClick={() => onCommit(draft)}><Check size={15} />Lưu & dựng cảnh</button></>}
      <details><summary>Nguồn đối tượng</summary><small>Asset {mapped?.asset_id ?? selectedAsset ?? "—"}</small><small>SHA {mapped?.source_sha256.slice(0, 16) ?? "Chưa dựng"}</small></details>
    </div>
  );
}

export function EventsTab({ scene, disabled, onEdit }: { scene: VisualScene | undefined; disabled: boolean; onEdit: () => void }) {
  return (
    <div className="visual-events"><strong>Voice reveals / events</strong>
      <button className="outline-btn" disabled={!scene || disabled} onClick={onEdit}>Chỉnh nhịp diễn theo lời kể</button>
      <Paged size={2} label="Sự kiện cảnh">{(scene?.events ?? []).map((e) => <p key={e.id}>{e.id} · {e.target}<small>{e.state_before} → {e.state_after} · {e.trigger.text ?? e.trigger.type}</small></p>)}</Paged></div>
  );
}

export function AssetsTab({ scene, disabled, query, onQuery, candidates, galleryAssets, onFind, onUse }: {
  scene: VisualScene | undefined; disabled: boolean; query: string; onQuery: (value: string) => void; candidates: CandidateResult | null; galleryAssets: GalleryAsset[];
  onFind: () => void; onUse: (candidateId: string) => void;
}) {
  return (
    <div className="visual-candidates"><strong>Đạo cụ phù hợp với cảnh</strong>
      <input aria-label="Asset constraints" value={query} placeholder="ID đạo cụ hoặc chọn từ Kho hình ảnh" onChange={(e) => onQuery(e.target.value)} />
      <button className="outline-btn" disabled={!scene || disabled} onClick={onFind}>Tìm bundle phù hợp</button>
      <Paged size={1} label="Composition">{(candidates?.bundles ?? []).map((c) => {
        const asset = galleryAssets.find((a) => a.id === c.asset_id || a.id === `prop:${c.asset_id}`);
        const src = asset?.preview_data_uri ?? (asset?.svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(asset.svg)}` : "");
        return (
          <div className="visual-candidate" key={c.candidate_id}><b>{c.asset_id}</b>
            {src ? <img className="candidate-thumbnail" src={src} alt={`Đạo cụ ${c.asset_id}`} /> : <small>Chưa có ảnh xem trước cho lựa chọn này.</small>}
            <small>{c.identity.model_id}</small><p>{c.fit_reasons.join(" · ")}</p>{c.warnings.map((w) => <small key={w}>{w}</small>)}
            {!!c.usage?.length && <small>{c.usage.length} build kỹ thuật · chưa duyệt{candidates?.usage_evidence?.coverage?.truncated ? " · phạm vi quét giới hạn" : ""}</small>}
            <button className="outline-btn" disabled={disabled} onClick={() => onUse(c.candidate_id)}>Dùng composition</button></div>);
      })}</Paged>
      {candidates?.new_asset_task && <p className="voice-warning">NO_FIT_ASSET · {candidates.new_asset_task.reason}</p>}
      {candidates?.usage_evidence?.coverage?.truncated && !candidates.bundles.some((c) => c.usage?.length) && <small>Lịch sử: phạm vi quét giới hạn, tối đa 500 project / 50 build.</small>}
      {candidates && <details><summary>{candidates.rejected.length} lựa chọn bị loại</summary><Paged size={1} label="Lựa chọn bị loại">{candidates.rejected.map((r) => <small key={r.id}>{r.id}: {r.reason}</small>)}</Paged></details>}</div>
  );
}

export function TransitionTab({ scene, isLast, disabled, onSet, onSetEverywhere }: {
  scene: VisualScene | undefined; isLast: boolean; disabled: boolean;
  onSet: (transition: Transition) => void; onSetEverywhere: (transition: Transition) => void;
}) {
  const [draft, setDraft] = useState<number | null>(null); // the slider commits on release, not on every tick (each commit is an undo step)
  useEffect(() => setDraft(null), [scene?.id]);
  if (!scene) return <p className="voice-muted">Chọn một cảnh trên timeline.</p>;
  if (isLast) return <p className="voice-muted">Cảnh cuối không có chuyển cảnh phía sau.</p>;
  const current: Transition = scene.transition ?? { preset: "dissolve", frames: 14 };
  const spec = TRANSITION_PRESETS[current.preset];
  return (
    <div className="visual-candidates"><strong>Chuyển sang cảnh sau · {transitionLabel(scene.transition?.preset)}</strong>
      <small>Lật trang và trượt giấy chỉ lật phần hình; phụ đề đứng yên. Các thành phần của cảnh sau có thể bay vào từ ngoài màn hình (sự kiện “enter”).</small>
      <label>Kiểu
        <select value={current.preset} disabled={disabled} onChange={(e) => { const preset = e.target.value as TransitionPreset; onSet({ preset, frames: preset === "cut" ? 0 : Math.max(TRANSITION_PRESETS[preset].min, current.frames) }); }}>
          {(Object.keys(TRANSITION_PRESETS) as TransitionPreset[]).map((id) => <option key={id} value={id}>{TRANSITION_PRESETS[id].label}</option>)}
        </select></label>
      {spec.max > 0 && <label>Độ dài: {draft ?? current.frames} khung ({((draft ?? current.frames) / 30).toFixed(2)} giây)
        <input type="range" min={spec.min} max={spec.max} value={draft ?? current.frames} disabled={disabled}
          onChange={(e) => setDraft(Number(e.target.value))}
          onPointerUp={() => { if (draft !== null && draft !== current.frames) onSet({ preset: current.preset, frames: draft }); setDraft(null); }}
          onKeyUp={() => { if (draft !== null && draft !== current.frames) onSet({ preset: current.preset, frames: draft }); setDraft(null); }} /></label>}
      <button className="outline-btn" disabled={disabled} onClick={() => onSetEverywhere(current)}>Áp dụng cho mọi cảnh</button>
    </div>
  );
}

export function AgentTab({ scene, connection, instruction, onInstruction, task, dismissedTask, disabled, onDismiss, onStart, onCancel, onApply }: {
  scene: VisualScene | undefined; connection: AgentHealth | null; instruction: string; onInstruction: (value: string) => void; task: AgentTask | null;
  dismissedTask: string | null; disabled: boolean; onDismiss: (taskId: string) => void; onStart: () => void; onCancel: (taskId: string) => void; onApply: (task: AgentTask) => void;
}) {
  const sceneTask = (task?.kind === "scene.propose" || task?.kind === "scene.revise") && task.scene_id === scene?.id && dismissedTask !== task.task_id ? task : null;
  return (
    <div className="visual-candidates"><strong>Sửa cảnh này · {scene?.id ?? "Chọn cảnh"}</strong>
      <small className="agent-connection-note">{connection?.available ? "Đã tìm thấy Codex" : "Chưa xác nhận Codex"} · {connection?.credential_available ? "Có cấu hình đăng nhập" : "Chưa xác nhận đăng nhập"}. Kết nối model được kiểm tra khi gửi yêu cầu.</small>
      <small>Agent chỉ sửa đúng phần bạn nói, giữ nguyên các cảnh khác. Bạn xem danh sách thay đổi và áp dụng; có thể Undo.</small>
      <textarea aria-label="Yêu cầu agent chỉnh cảnh" value={instruction} maxLength={1200} onChange={(e) => onInstruction(e.target.value)} placeholder="Ví dụ: Cho Nhân Mã lớn hơn và đưa điện thoại ra gần tay" />
      <button className="outline-btn" disabled={disabled || !scene || !instruction.trim() || (!!task && BUSY.includes(task.status))} onClick={onStart}>Sửa cảnh này</button>
      {sceneTask && <><AgentProposal task={sceneTask} />
        {sceneTask.status === "COMPLETED" && !sceneTask.write_applied && <button className="outline-btn" onClick={() => onDismiss(sceneTask.task_id)}>Bỏ đề xuất</button>}
        {BUSY.includes(sceneTask.status) && <button className="outline-btn" onClick={() => onCancel(sceneTask.task_id)}>Dừng agent</button>}
        <button className="primary-btn" disabled={disabled || sceneTask.status !== "COMPLETED" || sceneTask.write_applied} onClick={() => onApply(sceneTask)}>
          {sceneTask.write_applied ? "Đã áp dụng đề xuất" : "Xác nhận edit & dựng cảnh"}</button></>}
    </div>
  );
}
