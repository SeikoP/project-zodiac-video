import { useCallback, useEffect, useRef, useState } from "react";
import { openComposition, type Composition } from "@hyperframes/sdk";
import { HyperframesLogo } from "@hyperframes/studio/ui";
import { Check, FileJson, Layers3, LoaderCircle, Pause, Play, RefreshCcw, Undo2 } from "lucide-react";
import { backend, type AgentTask, type CandidateResult, type Project, type VisualPreview, type VisualState, type VisualTransform } from "./backend";

export default function VisualEditor({ project }: { project: Project | null }) {
  const [state, setState] = useState<VisualState | null>(null), [sceneId, setSceneId] = useState("");
  const [entityId, setEntityId] = useState(""), [stateId, setStateId] = useState("");
  const [preview, setPreview] = useState<VisualPreview | null>(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [sourceText, setSourceText] = useState(""), [sourceOpen, setSourceOpen] = useState(false);
  const [draft, setDraft] = useState<VisualTransform | null>(null), [candidates, setCandidates] = useState<CandidateResult | null>(null), [query, setQuery] = useState("");
  const [time, setTime] = useState(0), [playing, setPlaying] = useState(false), [scale, setScale] = useState(.25);
  const [sdkReady, setSdkReady] = useState(false), [audioUrl, setAudioUrl] = useState("");
  const [agentInstruction, setAgentInstruction] = useState(""), [agentTask, setAgentTask] = useState<AgentTask | null>(null);
  const iframe = useRef<HTMLIFrameElement>(null), viewport = useRef<HTMLDivElement>(null), sdk = useRef<Composition | null>(null);
  const loadedPreview = useRef<{ sha256: string; build_id: string; scene_id: string } | null>(null);
  const audio = useRef<HTMLAudioElement>(null), playhead = useRef(0), pointer = useRef<{ x: number; y: number; transform: VisualTransform } | null>(null);
  const projectId = project?.project_id, running = state?.job?.status === "RUNNING";
  const scene = state?.intent?.scenes.find(s => s.id === sceneId) ?? state?.intent?.scenes[0];
  const entity = scene?.entities.find(e => e.id === entityId) ?? scene?.entities[0];
  const selectedStateId = entity?.states[stateId] ? stateId : entity?.initial_state;
  const selected = selectedStateId ? entity?.states[selectedStateId] : undefined;
  const built = state?.build?.scenes.find(s => s.id === scene?.id), sourceMap = preview?.scene?.source_map ?? [];
  const mapped = sourceMap.find(m => m.entity_id === entity?.id && m.state_id === selectedStateId);
  const candidateBuildId = scene && state?.job?.status === "RUNNING" && state.job.revision === state.revision && state.job.ready_scenes.includes(scene.id) ? state.job.id : null;
  const effectiveBuildId = candidateBuildId ?? state?.build?.id;
  const duration = preview?.scene?.duration_seconds ?? built?.duration_seconds ?? 0;
  const report = useCallback((value: unknown) => setError(value instanceof Error ? value.message : String(value)), []);

  useEffect(() => {
    if (!projectId) return;
    let live = true;
    const refresh = async () => { try { const next = await backend.visualOpen(projectId); if (live) setState(next); } catch (failure) { if (live) report(failure); } };
    void refresh(); const timer = window.setInterval(() => void refresh(), 1500);
    return () => { live = false; window.clearInterval(timer); };
  }, [projectId, report]);
  useEffect(() => { setDraft(selected ? { ...selected.transform } : null); }, [scene?.id, entity?.id, selectedStateId, state?.revision]);
  useEffect(() => { setCandidates(null); }, [scene?.id, state?.revision]);
  useEffect(() => {
    const node = viewport.current; if (!node) return;
    const observer = new ResizeObserver(() => setScale(Math.min(node.clientWidth / 1080, node.clientHeight / 1920)));
    observer.observe(node); return () => observer.disconnect();
  }, [!!preview]);
  useEffect(() => {
    if (!projectId || !scene || !effectiveBuildId) {
      sdk.current?.dispose(); sdk.current = null; loadedPreview.current = null; setPreview(null); setSdkReady(false); setPlaying(false);
      return;
    }
    let live = true;
    void backend.visualPreview(projectId, scene.id, effectiveBuildId).then(async next => {
      if (loadedPreview.current?.sha256 === next.sha256 && loadedPreview.current.build_id === next.build_id && sdk.current) {
        if (live) setPreview(next);
        return;
      }
      const composition = await openComposition(next.html, { overrides: {}, history: false });
      if (!live) { composition.dispose(); return; }
      sdk.current?.dispose(); sdk.current = composition;
      const at = loadedPreview.current?.scene_id === scene.id ? Math.min(playhead.current, next.scene.duration_seconds ?? 0) : 0;
      loadedPreview.current = { sha256: next.sha256, build_id: next.build_id, scene_id: scene.id };
      setPreview(next); setSdkReady(true); setPlaying(false); setTime(at); playhead.current = at;
    }).catch(failure => { if (live) report(failure); });
    return () => { live = false; };
  }, [projectId, scene?.id, effectiveBuildId, candidateBuildId, report]);
  useEffect(() => () => sdk.current?.dispose(), []);
  useEffect(() => {
    if (!agentTask || !["STARTING", "RUNNING"].includes(agentTask.status)) return;
    const timer = window.setInterval(() => void backend.agentTask(agentTask.task_id).then(setAgentTask).catch(report), 1000);
    return () => window.clearInterval(timer);
  }, [agentTask?.task_id, agentTask?.status, report]);
  useEffect(() => {
    let live = true, local = "";
    if (!projectId || !state?.build) return;
    void backend.voiceOpen(projectId).then(async voice => {
      if (!voice.assembly || voice.assembly.wav_sha256 !== state.build?.voice_sha256) { if (live) setAudioUrl(""); return; }
      local = URL.createObjectURL(await backend.voiceAudio(projectId, "episode", voice.assembly.take_id));
      if (live) setAudioUrl(local); else URL.revokeObjectURL(local);
    }).catch(failure => { if (live) report(failure); });
    return () => { live = false; if (local) URL.revokeObjectURL(local); };
  }, [projectId, state?.build?.id, report]);
  useEffect(() => {
    function message(event: MessageEvent) {
      if (!preview || event.source !== iframe.current?.contentWindow || event.origin !== new URL(preview.url).origin) return;
      if (event.data?.type === "zodiac-preview-select") {
        const match = sourceMap.find(m => m.hf_id === event.data.hf_id);
        if (match) { setEntityId(match.entity_id); setStateId(match.state_id); sdk.current?.setSelection([match.hf_id]); }
      }
    }
    window.addEventListener("message", message); return () => window.removeEventListener("message", message);
  }, [preview]);
  function send(action: string, extra: object) {
    if (preview) iframe.current?.contentWindow?.postMessage({ type: "zodiac-preview", action, ...extra }, new URL(preview.url).origin);
  }
  function seek(value: number) {
    const at = Math.max(0, Math.min(duration, value)); setTime(at); playhead.current = at; send("seek", { time: at });
    if (audio.current && built) audio.current.currentTime = built.start_ms / 1000 + at;
  }
  useEffect(() => {
    if (!playing) { audio.current?.pause(); return; }
    let frame = 0, last = performance.now();
    if (audio.current && built && audioUrl) {
      audio.current.currentTime = built.start_ms / 1000 + playhead.current;
      void audio.current.play().catch(report);
    }
    const tick = (now: number) => {
      const next = audio.current && built && !audio.current.paused ? audio.current.currentTime - built.start_ms / 1000 : playhead.current + (now - last) / 1000;
      last = now; playhead.current = Math.min(duration, next); setTime(playhead.current); send("seek", { time: playhead.current });
      if (next >= duration) setPlaying(false); else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); return () => { cancelAnimationFrame(frame); audio.current?.pause(); };
  }, [playing, duration, preview?.url, audioUrl]);
  async function action(operation: () => Promise<VisualState>) {
    setBusy(true); setError("");
    try { setState(await operation()); } catch (failure) { report(failure); } finally { setBusy(false); }
  }
  function command(kind: string, payload: object) {
    if (projectId && state) void action(async () => {
      const next = await backend.visualCommand(projectId, state.revision, kind, payload);
      const scope = "scene_id" in payload && typeof payload.scene_id === "string" ? payload.scene_id : undefined;
      return next.build && kind !== "source.replace" ? backend.episodeBuild(projectId, next.revision, scope) : next;
    });
  }
  async function commitTransform(value: VisualTransform) {
    if (!projectId || !state || !scene || !entity || !selectedStateId) return;
    setBusy(true); setError("");
    try {
      if (mapped && sdk.current) {
        const styles = { left: `${value.x}px`, top: `${value.y}px`, width: `${value.width}px`, height: `${value.height}px` };
        const permitted = sdk.current.can({ type: "setStyle", target: mapped.hf_id, styles });
        if (!permitted.ok) throw new Error(permitted.message);
        sdk.current.setStyle(mapped.hf_id, styles);
      }
      const next = await backend.visualCommand(projectId, state.revision, "scene.patch", {
        scene_id: scene.id, entity_id: entity.id, state_id: selectedStateId, changes: value,
      });
      setState(await backend.episodeBuild(projectId, next.revision, scene.id));
    } catch (failure) { report(failure); } finally { setBusy(false); }
  }
  async function loadSource(file: File) {
    if (file.size > 2 * 1024 * 1024) { report(new Error("Visual Intent tối đa 2 MiB")); return; }
    setSourceText(await file.text()); setSourceOpen(true);
  }
  const disabled = busy || running;
  if (!project) return <section className="panel voice-empty"><Layers3 size={30}/><h2>Chọn episode để mở Visual Workspace</h2></section>;
  return <section className="visual-editor">
    <div className="hf-head"><span className="hf-brand"><HyperframesLogo/><strong>Visual Workspace</strong></span>
      <span className="status-chip status-neutral">R{state?.revision ?? 0} · {sdkReady ? "HyperFrames SDK" : "Canonical Visual Intent"}</span></div>
    {error && <div className="inline-alert error" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}
    <div className="visual-toolbar"><button className="outline-btn" onClick={() => setSourceOpen(!sourceOpen)}><FileJson size={15}/>Nguồn Visual Intent</button>
      <button className="outline-btn" disabled={disabled || !state?.can_undo} onClick={() => command("undo", {})}><Undo2 size={15}/>Undo</button>
      <button className="outline-btn" disabled={disabled || !state?.can_redo} onClick={() => command("redo", {})}>Redo</button>
      <label>Theme<select value={state?.theme ?? "light"} disabled={disabled || !state?.intent} onChange={event => command("theme.select", { theme: event.target.value })}>
        <option value="light">Giấy sáng</option><option value="dark">Nền tối</option></select></label>
      <button className="primary-btn" disabled={disabled || !state?.intent} onClick={() => state && void action(() => backend.episodeBuild(project.project_id, state.revision))}>
        {running ? <LoaderCircle size={15} className="spin"/> : <RefreshCcw size={15}/>}Dựng cả episode</button>
      {running && <button className="outline-btn" onClick={() => void action(() => backend.visualCancel(project.project_id))}>Dừng build</button>}</div>
    {sourceOpen && <div className="panel visual-source"><label>Nhập nguồn zodiac-visual-intent@1<input type="file" accept=".json,application/json" onChange={e => e.target.files?.[0] && void loadSource(e.target.files[0])}/></label>
      <textarea aria-label="Canonical Visual Intent" value={sourceText} onChange={e => setSourceText(e.target.value)} placeholder="Dán Visual Intent do bạn hoặc agent soạn từ nội dung đã duyệt" spellCheck={false}/>
      <div className="agent-actions"><button className="outline-btn" onClick={() => setSourceText(JSON.stringify(state?.intent, null, 2) ?? "")}>Đọc nguồn hiện tại</button>
        <button className="primary-btn" disabled={disabled || !sourceText.trim()} onClick={() => { try { command("source.replace", { intent: JSON.parse(sourceText) }); } catch (failure) { report(failure); } }}>Lưu nguồn có kiểm tra</button></div>
      <small>Thao tác authoring giữ nguyên narration, receipt duyệt và voice. HTML preview không có quyền ghi nguồn.</small></div>}
    {state?.job && <div className="voice-progress"><span>{state.job.message}</span><span>{state.job.status} · {state.job.ready_scenes.length}/{state.job.total}</span>{state.job.error && <pre>{state.job.error}</pre>}</div>}
    {state?.stale_preview && <p className="voice-warning">Đang giữ preview tốt R{state.build?.revision}. Nguồn hiện tại R{state.revision}; dựng lại để xem thay đổi.</p>}
    <div className="visual-layout"><aside className="panel visual-scenes"><div className="panel-heading">Scenes · {state?.intent?.scenes.length ?? 0}</div>
      {state?.intent?.scenes.map((item, index) => <button key={item.id} className={scene?.id === item.id ? "active" : ""} onClick={() => { setSceneId(item.id); setEntityId(""); setStateId(""); setPlaying(false); }}>
        <span>{String(index + 1).padStart(2, "0")} · {item.id}</span><small>{item.semantic_goal}</small><em>{state.build?.scenes.some(s => s.id === item.id) ? "Preview có thật" : state.job?.ready_scenes.includes(item.id) ? "Candidate đang build" : "Chưa dựng"}</em></button>)}
      {!state?.intent && <p>Chưa có storyboard. Nhập Visual Intent đã soạn từ nguồn được duyệt.</p>}</aside>
      <div className="panel visual-stage"><div className="panel-heading"><span>{scene?.id ?? "Preview"}</span><small>{preview ? `Build ${preview.build_id.slice(0, 8)} · R${preview.revision}` : "Chưa có output"}</small></div>
        <div className="visual-viewport" ref={viewport}>{preview ? <iframe key={preview.url} ref={iframe} src={preview.url} title={`HyperFrames ${scene?.id}`} sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer"
          style={{ width: 1080, height: 1920, transform: `scale(${scale})` }} onLoad={() => send("seek", { time: playhead.current })}/>
          : <div className="voice-empty"><Layers3 size={36}/><p>Preview dùng SVG thật và timing ASR đã đo.</p><small>Hoàn tất timing ở Voice Lab rồi dựng episode.</small></div>}
          {preview && draft && mapped && !playing && !state?.stale_preview && <div className="visual-drag-box" aria-label={`Di chuyển ${entity?.id}`} role="button" tabIndex={0}
            style={{ left: `calc(50% - ${540 * scale}px + ${draft.x * scale}px)`, top: `calc(50% - ${960 * scale}px + ${draft.y * scale}px)`, width: draft.width * scale, height: draft.height * scale }}
            onPointerDown={e => { if (!disabled) { e.currentTarget.setPointerCapture(e.pointerId); pointer.current = { x: e.clientX, y: e.clientY, transform: { ...draft } }; } }}
            onPointerMove={e => { const p = pointer.current; if (p) setDraft({ ...p.transform, x: Math.round(p.transform.x + (e.clientX - p.x) / scale), y: Math.round(p.transform.y + (e.clientY - p.y) / scale) }); }}
            onPointerUp={() => { if (pointer.current && draft) { pointer.current = null; void commitTransform(draft); } }}
            onPointerCancel={() => { pointer.current = null; if (selected) setDraft({ ...selected.transform }); }}/>}</div>
        <div className="visual-transport"><button className="outline-btn" disabled={!preview || !duration} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={16}/> : <Play size={16}/>}</button>
          <span>{time.toFixed(2)} / {duration.toFixed(2)}s</span><input type="range" aria-label="Measured scene timeline" min={0} max={duration || 1} step={1 / 30} value={time} onChange={e => { setPlaying(false); seek(Number(e.target.value)); }}/>
          <small>{audioUrl ? "Voice đã chọn" : "Preview không audio"}</small></div>{audioUrl && <audio ref={audio} src={audioUrl} preload="metadata"/>}
        <div className="visual-fidelity"><strong>{preview?.candidate_only ? "Candidate trong lúc dựng" : "Preview kỹ thuật"}</strong><span>SVG nguồn · timing ASR · chưa duyệt hình</span></div>
        {built && <p className="voice-muted">Caption contrast {built.qa.caption_contrast.toFixed(1)}:1 · QA {built.qa.status} · {built.qa.issues.map(i => i.code).join(", ") || "Không có cảnh báo kỹ thuật"}</p>}</div>
      <aside className="panel visual-inspector"><div className="panel-heading">Inspector · Semantic source</div>
        <label>Entity<select value={entity?.id ?? ""} onChange={e => { setEntityId(e.target.value); setStateId(""); }}>{scene?.entities.map(e => <option key={e.id} value={e.id}>{e.id} · {e.kind}</option>)}</select></label>
        <label>State<select value={selectedStateId ?? ""} onChange={e => { setStateId(e.target.value); const map = sourceMap.find(m => m.entity_id === entity?.id && m.state_id === e.target.value); if (map) send("state", { hf_id: map.hf_id }); }}>{Object.keys(entity?.states ?? {}).map(id => <option key={id}>{id}</option>)}</select></label>
        {draft && <><div className="visual-transform">{(["x", "y", "width", "height", "rotation"] as const).map(key => <label key={key}>{key}<input type="number" value={draft[key] ?? 0} disabled={disabled} onChange={e => setDraft({ ...draft, [key]: Number(e.target.value) })}/></label>)}</div>
          <button className="primary-btn" disabled={disabled || !sdkReady} onClick={() => void commitTransform(draft)}><Check size={15}/>Lưu & dựng cảnh</button></>}
        <small>Asset {mapped?.asset_id ?? selected?.asset ?? "—"}</small><small>Source {mapped?.source_sha256.slice(0, 16) ?? "Chưa build"}</small>
        <div className="visual-events"><strong>Voice reveals / events</strong>{scene?.events.map(e => <p key={e.id}>{e.id} · {e.target}<small>{e.state_before} → {e.state_after} · {e.trigger.text ?? e.trigger.type}</small></p>)}</div>
        <div className="visual-candidates"><strong>Composition candidates</strong><input aria-label="Asset constraints" value={query} placeholder="Family, ví dụ phone" onChange={e => setQuery(e.target.value)}/>
          <button className="outline-btn" disabled={!scene || disabled} onClick={() => { if (scene) void backend.visualCandidates(project.project_id, scene.id, query ? { family_id: query } : {}).then(setCandidates).catch(report); }}>Tìm bundle phù hợp</button>
          {candidates?.bundles.map(c => <div className="visual-candidate" key={c.candidate_id}><b>{c.asset_id}</b><small>{c.identity.model_id}</small><p>{c.fit_reasons.join(" · ")}</p>{c.warnings.map(w => <small key={w}>{w}</small>)}
            <button className="outline-btn" disabled={disabled} onClick={() => command("asset.select", { scene_id: scene?.id, candidate_id: c.candidate_id, requirement: query ? { family_id: query } : {} })}>Dùng composition</button></div>)}
          {candidates?.new_asset_task && <p className="voice-warning">NO_FIT_ASSET · {candidates.new_asset_task.reason}</p>}
          {candidates && <details><summary>{candidates.rejected.length} lựa chọn bị loại</summary>{candidates.rejected.map(r => <small key={r.id}>{r.id}: {r.reason}</small>)}</details>}</div>
        <div className="visual-candidates"><strong>Agent chỉnh cảnh đang chọn</strong>
          <textarea aria-label="Yêu cầu agent chỉnh cảnh" value={agentInstruction} maxLength={1200} onChange={e => setAgentInstruction(e.target.value)} placeholder="Ví dụ: Dịch actor lead sang phải 40px, giữ kích thước"/>
          <button className="outline-btn" disabled={disabled || !scene || !agentInstruction.trim() || !!agentTask && ["STARTING", "RUNNING"].includes(agentTask.status)}
            onClick={() => scene && void backend.visualAgentStart(project.project_id, scene.id, agentInstruction).then(setAgentTask).catch(report)}>Đề xuất chỉnh sửa</button>
          {agentTask && <><small>{agentTask.status} · {agentTask.error ?? "Chưa ghi nguồn khi chưa xác nhận"}</small><pre className="visual-agent-proposal">{agentTask.suggestion || agentTask.preview}</pre>
            {["STARTING", "RUNNING"].includes(agentTask.status) && <button className="outline-btn" onClick={() => void backend.agentCancel(agentTask.task_id).then(setAgentTask).catch(report)}>Dừng agent</button>}
            <button className="primary-btn" disabled={disabled || agentTask.status !== "COMPLETED" || agentTask.write_applied} onClick={() => state && void action(async () => {
              const next = await backend.visualAgentApply(agentTask.task_id, state.revision);
              setAgentTask(await backend.agentTask(agentTask.task_id));
              return backend.episodeBuild(project.project_id, next.revision, scene?.id);
            })}>Xác nhận edit & dựng cảnh</button></>}
        </div></aside></div>
    {state?.build && <div className="visual-receipt">{state.build.scenes.length} scenes · {state.build.cache.reused} nodes cache / {state.build.cache.rebuilt} dựng lại · {(state.build.resources.wall_ms / 1000).toFixed(2)}s · {(state.build.resources.peak_rss_bytes / 1024 / 1024).toFixed(0)} MiB peak · Renderer parity: {state.build.renderer_parity}</div>}
    <details className="panel visual-log"><summary>Hoạt động chỉnh sửa và build</summary>{state?.events.slice().reverse().map(e => <p key={e.event_seq}>R{e.revision} · {e.kind} · {String(e.payload.scene_id ?? e.payload.build_id ?? "")}</p>)}</details>
  </section>;
}
