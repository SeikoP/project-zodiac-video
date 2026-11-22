import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { openComposition, type Composition } from "@hyperframes/sdk";
import { HyperframesLogo } from "@hyperframes/studio/ui";
import { Check, FileJson, Layers3, LoaderCircle, Pause, Play, RefreshCcw, Undo2 } from "lucide-react";
import { backend, type AgentTask, type CandidateResult, type Project, type VisualPreview, type VisualState, type VisualTransform, type VoiceState, type AgentHealth, type GalleryAsset } from "./backend";

import AssetGallery from "./AssetGallery";
import AgentProposal from "./AgentProposal";
import { Paged, PagedText } from "./Paged";
import EpisodeTimeline from "./EpisodeTimeline";
import {makeEpisodeTimeline, locateEpisodeTime} from "./episode-timeline";
import type { WorkbenchSelection } from "./workbench-state";

export default function VisualEditor({ project, active = true, onBuildReady, selection, onSelectionChange, onVoice, onImport }: { project: Project | null; active?: boolean; onBuildReady?: (projectId: string, ready: boolean) => void; selection?: WorkbenchSelection; onSelectionChange?: (selection: WorkbenchSelection) => void; onVoice?: () => void; onImport?: () => void }) {
  const [galleryOpen, setGalleryOpen] = useState(false), [eventsOpen, setEventsOpen] = useState(false), [eventsText, setEventsText] = useState("");
  const [connection,setConnection]=useState<AgentHealth | null>(null);
  const [galleryAssets,setGalleryAssets]=useState<GalleryAsset[]>([]);
  const [themes, setThemes] = useState<{ id: string; title?: string }[]>([]);
  const [technicalOpen,setTechnicalOpen]=useState(false);
  const [tab, setTab] = useState("object"), [logOpen, setLogOpen] = useState(false);
  const [state, setState] = useState<VisualState | null>(null), [sceneId, setSceneId] = useState(selection?.sceneId ?? "");
  const [entityId, setEntityId] = useState(selection?.entityId ?? ""), [stateId, setStateId] = useState("");
  const [preview, setPreview] = useState<VisualPreview | null>(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [sourceText, setSourceText] = useState(""), [sourceOpen, setSourceOpen] = useState(false);
  const [draft, setDraft] = useState<VisualTransform | null>(null), [candidates, setCandidates] = useState<CandidateResult | null>(null), [query, setQuery] = useState("");
  const [episodeTime,setEpisodeTime] = useState(selection?.timeMs ?? 0);
  const globalPlayhead = useRef(selection?.timeMs ?? 0);
  const [voiceInfo,setVoiceInfo] = useState<VoiceState | null>(null);
  const [frameReady,setFrameReady] = useState(false);
  const [time, setTime] = useState(0), [playing, setPlaying] = useState(false), [scale, setScale] = useState(.25);
  const [sdkReady, setSdkReady] = useState(false), [audioUrl, setAudioUrl] = useState("");
  const [agentInstruction, setAgentInstruction] = useState(""), [agentTask, setAgentTask] = useState<AgentTask | null>(null);
  const iframe = useRef<HTMLIFrameElement>(null), viewport = useRef<HTMLDivElement>(null), sdk = useRef<Composition | null>(null);
  const loadedPreview = useRef<{ sha256: string; build_id: string; scene_id: string } | null>(null);
  const audio = useRef<HTMLAudioElement>(null), playhead = useRef(0), pointer = useRef<{ x: number; y: number; transform: VisualTransform } | null>(null);
  const projectId = project?.project_id, running = state?.job?.status === "RUNNING";
  const scene = state?.intent?.scenes.find(s => s.id === sceneId) ?? state?.intent?.scenes[0];
  useEffect(() => {
    if (projectId && scene) onSelectionChange?.({projectId, sceneId: scene.id, entityId: entityId || scene.entities[0]?.id || null, timeMs: episodeTime});
  }, [projectId, scene?.id, entityId, episodeTime, onSelectionChange]);
  const entity = scene?.entities.find(e => e.id === entityId) ?? scene?.entities[0];
  const selectedStateId = entity?.states[stateId] ? stateId : entity?.initial_state;
  const selected = selectedStateId ? entity?.states[selectedStateId] : undefined;
  const built = state?.build?.scenes.find(s => s.id === scene?.id), sourceMap = preview?.scene?.source_map ?? [];
  const mapped = sourceMap.find(m => m.entity_id === entity?.id && m.state_id === selectedStateId);
  const candidateBuildId = scene && state?.job?.status === "RUNNING" && state.job.revision === state.revision && state.job.ready_scenes.includes(scene.id) ? state.job.id : null;
  const effectiveBuildId = candidateBuildId ?? state?.build?.id;
  const timelineResult = useMemo(() => {
    try { return {scenes:makeEpisodeTimeline(state?.build?.scenes ?? []),error:""}; }
    catch (e) { return {scenes:[],error:e instanceof Error ? e.message : String(e)}; }
  }, [state?.build?.scenes]);
  const timeline=timelineResult.scenes, episodeDuration=timeline.at(-1)?.endMs ?? 0;
  const duration = preview?.scene?.duration_seconds ?? built?.duration_seconds ?? 0;
  useEffect(()=>{if(!active || !projectId)return;let live=true;
    void backend.agentHealth().then(h=>{if(live)setConnection(h);}).catch(()=>{if(live)setConnection(null);});
    return ()=>{live=false;};
  },[active,projectId]);
  const report = useCallback((value: unknown) => setError(value instanceof Error ? value.message : String(value)), []);
  useEffect(() => {
    if (projectId) onBuildReady?.(projectId, !!state?.build && !state.stale_preview);
  }, [projectId, state?.build?.id, state?.stale_preview, onBuildReady]);
  useEffect(() => { if (!active) { setPlaying(false); audio.current?.pause(); } }, [active]);
  useEffect(() => {
    if (!projectId) return;
    let live = true;
    void backend.agentTasks(projectId).then(tasks => { if (live) setAgentTask(tasks.find(t => t.kind !== "project.inspect") ?? null); }).catch(report);
    return () => { live = false; };
  }, [projectId, report]);

  useEffect(() => {
    if (!projectId) return;
    let live = true;
    void backend.assetGallery(projectId).then(data => { if (live) {setThemes(data.themes);setGalleryAssets(data.items);} }).catch(report);
    return () => { live = false; };
  }, [projectId, report]);
  useEffect(() => {
    if (!projectId) return;
    let live = true;
    let pending = false;
    const refresh = async () => {
      if (pending || !live || !active) return;
      pending = true;
      try { const next = await backend.visualOpen(projectId); if (live) setState(next); }
      catch (failure) { if (live) report(failure); } finally { pending = false; }
    };
    void refresh(); const timer = window.setInterval(() => void refresh(), 1500);
    return () => { live = false; window.clearInterval(timer); };
  }, [projectId, active, report]);
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
    setFrameReady(false); setPreview(null); setSdkReady(false);
    void backend.visualPreview(projectId, scene.id, effectiveBuildId).then(async next => {
      if (loadedPreview.current?.sha256 === next.sha256 && loadedPreview.current.build_id === next.build_id && sdk.current) {
        if (live) setPreview(next);
        return;
      }
      const composition = await openComposition(next.html, { overrides: {}, history: false });
      if (!live) { composition.dispose(); return; }
      sdk.current?.dispose(); sdk.current = composition;
      const position=locateEpisodeTime(timeline,globalPlayhead.current);
      const at=position?.sceneId===scene.id ? position.localMs/1000 : 0;
      loadedPreview.current = { sha256: next.sha256, build_id: next.build_id, scene_id: scene.id };
      setPreview(next); setSdkReady(true); setTime(at); playhead.current = at;
    }).catch(failure => { if (live) {setPlaying(false); report(failure);} });
    return () => { live = false; };
  }, [projectId, scene?.id, effectiveBuildId, candidateBuildId, report]);
  useEffect(() => () => sdk.current?.dispose(), []);
  useEffect(() => {
    if (!agentTask || !["STARTING", "RUNNING"].includes(agentTask.status)) return;
    let live = true;
    const timer = window.setInterval(() => void backend.agentTask(agentTask.task_id).then(task => { if (live) setAgentTask(task); }).catch(failure => { if (live) report(failure); }), 1000);
    return () => { live = false; window.clearInterval(timer); };
  }, [agentTask?.task_id, agentTask?.status, report]);
  useEffect(() => {
    let live = true, local = "";
    setAudioUrl(""); setVoiceInfo(null);
    if (!projectId || !state) return;
    void backend.voiceOpen(projectId).then(async voice => {
      if (!state.build) {if(live)setVoiceInfo(voice);return;}
      if (!voice.assembly || voice.assembly.valid===false || voice.assembly.wav_sha256 !== state.build?.voice_sha256) { if (live) setAudioUrl(""); return; }
      if (live) setVoiceInfo(voice);
      local = URL.createObjectURL(await backend.voiceAudio(projectId, "episode", voice.assembly.take_id));
      if (live) setAudioUrl(local); else URL.revokeObjectURL(local);
    }).catch(failure => { if (live) report(failure); });
    return () => { live = false; if (local) URL.revokeObjectURL(local); };
  }, [projectId, !!state, state?.build?.id, report]);
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
  function seekEpisode(value: number) {
    const at=Math.max(0,Math.min(episodeDuration,value));
    globalPlayhead.current=at; setEpisodeTime(at);
    const position=locateEpisodeTime(timeline,at);
    if (position) {
      if (position.sceneId !== scene?.id) {setSceneId(position.sceneId); setEntityId(""); setStateId("");}
      playhead.current=position.localMs/1000; setTime(playhead.current);
      if (position.sceneId===loadedPreview.current?.scene_id) send("seek",{time:playhead.current});
    }
    if (audio.current && audioUrl) audio.current.currentTime=at/1000;
  }
  function seek(value: number) { seekEpisode((built?.start_ms ?? 0)+value*1000); }
  function chooseScene(id: string) {
    setPlaying(false); setEntityId(""); setStateId(""); setSceneId(id);
    const row=timeline.find(s=>s.id===id); if(row) seekEpisode(row.startMs);
  }
  useEffect(() => {setPlaying(false); audio.current?.pause();}, [state?.revision,state?.build?.id,state?.stale_preview]);
  useEffect(() => {
    if (!playing || !active || !preview || !frameReady || !episodeDuration || state?.stale_preview) {audio.current?.pause();return;}
    let frame=0, last=performance.now(), painted=0, live=true;
    const player=audio.current;
    if (player && audioUrl) {
      player.currentTime=globalPlayhead.current/1000;
      void player.play().catch(e=>{if(live){setPlaying(false);report(e);}});
    }
    const tick=(now: number) => {
      const at=Math.min(episodeDuration,player && audioUrl ? player.currentTime*1000 : globalPlayhead.current+now-last);
      last=now; globalPlayhead.current=at;
      const position=locateEpisodeTime(timeline,at);
      if (position && position.sceneId!==scene?.id) {
        setEpisodeTime(at); setSceneId(position.sceneId); setEntityId(""); setStateId("");
        setFrameReady(false); player?.pause(); return;
      }
      if(now-painted>=1000/30 || at>=episodeDuration) {
        painted=now;setEpisodeTime(at);
        if(position){playhead.current=position.localMs/1000;setTime(playhead.current);send("seek",{time:playhead.current});}
      }
      if(at>=episodeDuration) setPlaying(false); else frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return ()=>{live=false;cancelAnimationFrame(frame);player?.pause();};
  }, [playing,active,preview?.url,frameReady,audioUrl,episodeDuration,scene?.id,state?.stale_preview]);
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
  useEffect(() => { setPlaying(false); }, [sourceOpen, logOpen]);
  const disabled = busy || running;
  if (!project) return <section className="panel voice-empty"><Layers3 size={30}/><h2>Bắt đầu video của bạn</h2><p>Nhập ZIP nội dung đã duyệt hoặc chọn episode ở phía trên.</p><button className="primary-btn" onClick={onImport}>Nhập nội dung đã duyệt</button></section>;
  return <section className="visual-editor">
    <div className="hf-head"><span className="hf-brand"><HyperframesLogo/><strong>Chọn cảnh · xem · chỉnh sửa</strong></span>
      <span className="status-chip status-neutral">R{state?.revision ?? 0} · {sdkReady ? "HyperFrames SDK" : "Canonical Visual Intent"}</span></div>
    {error && <div className="inline-alert error" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}
    <div className="visual-toolbar"><button className="outline-btn" onClick={() => { setGalleryOpen(!galleryOpen); setSourceOpen(false); setLogOpen(false); setEventsOpen(false); setPlaying(false); }}>Kho hình ảnh</button><button className="outline-btn" hidden={!technicalOpen} onClick={() => { setSourceOpen(!sourceOpen); setLogOpen(false); setGalleryOpen(false); setEventsOpen(false); }}><FileJson size={15}/>Nguồn Visual Intent</button>
      <button className="outline-btn" disabled={disabled || !state?.can_undo} onClick={() => command("undo", {})}><Undo2 size={15}/>Undo</button>
      <button className="outline-btn" disabled={disabled || !state?.can_redo} onClick={() => command("redo", {})}>Redo</button>
      <button className="outline-btn" aria-expanded={technicalOpen} onClick={()=>setTechnicalOpen(!technicalOpen)}>Chi tiết</button>
      <label>Màu sắc<select value={state?.theme ?? "light"} disabled={disabled || !state?.intent} onChange={event => command("theme.select", { theme: event.target.value })}>
        {(themes.length ? themes : [{ id: "light", title: "Giấy sáng" }, { id: "dark", title: "Nền tối" }]).map(t => <option key={t.id} value={t.id}>{t.title ?? t.id}</option>)}</select></label>
      <button className="primary-btn" disabled={disabled || !state?.intent} onClick={() => state && void action(() => backend.episodeBuild(project.project_id, state.revision))}>
        {running ? <LoaderCircle size={15} className="spin"/> : <RefreshCcw size={15}/>}Dựng cả episode</button>
      {running && <button className="outline-btn" onClick={() => void action(() => backend.visualCancel(project.project_id))}>Dừng tác vụ</button>}</div>
    {!state?.intent && <div className="panel initial-authoring"><strong>Bước tiếp theo: tạo hình ảnh cho video</strong>
      {!voiceInfo?.timing?.words.length && <p>Chuẩn bị giọng đọc và căn thời gian trước khi nhờ agent soạn hình. <button className="outline-btn" onClick={onVoice}>Mở phần giọng đọc</button></p>}<small>Agent dùng bản kể đã duyệt và timing của giọng đã chọn. Xem đề xuất trước khi áp dụng.</small>
      <textarea aria-label="Yêu cầu agent soạn hình ảnh" maxLength={1200} value={agentInstruction} onChange={e => setAgentInstruction(e.target.value)} placeholder="Diễn rõ lời bào chữa và bằng chứng phản bác, giữ phản ứng đủ đọc."/>
      <button className="primary-btn" disabled={!state || !voiceInfo?.assembly || !voiceInfo?.timing?.words.length || disabled || !!agentTask && ["STARTING", "RUNNING"].includes(agentTask.status)} onClick={() => void backend.authorAgentStart(project.project_id, agentInstruction.trim() || "Dựng các cảnh theo narrative plan đã duyệt, có hành động và phản ứng rõ.").then(setAgentTask).catch(report)}>Soạn bản dựng ban đầu</button>
      {agentTask?.kind === "episode.propose" && <><AgentProposal task={agentTask}/>
        {["STARTING", "RUNNING"].includes(agentTask.status) && <button className="outline-btn" onClick={() => void backend.agentCancel(agentTask.task_id).then(setAgentTask).catch(report)}>Dừng agent</button>}
        <button className="primary-btn" disabled={disabled || agentTask.status !== "COMPLETED" || agentTask.write_applied} onClick={() => state && void action(async () => {
          const next = await backend.visualAgentApply(agentTask.task_id, state.revision);
          setAgentTask(await backend.agentTask(agentTask.task_id));
          return next;
        })}>Áp dụng bản dựng đề xuất</button></>}
    </div>}
    {galleryOpen && <AssetGallery projectId={projectId ?? null} onFind={id => {
      setGalleryOpen(false); setTab("assets"); setQuery(id);
      if (scene) void backend.visualCandidates(project.project_id, scene.id, { asset_id: id }).then(setCandidates).catch(report);
    }}/>}
    {eventsOpen && <div className="panel visual-source"><strong>Nhịp diễn · {scene?.id}</strong><small>Dùng state và đạo cụ có sẵn: ý định → hành động/tiếp xúc → phản ứng → giữ đủ đọc. Voice anchor phải đúng lời đã duyệt; giữ tiếp xúc tay–đạo cụ khi chuyển động.</small>
      <PagedText label="Sự kiện diễn xuất" size={600} text={eventsText} onChange={setEventsText}/>
      <div className="agent-actions"><button className="outline-btn" onClick={() => setEventsOpen(false)}>Đóng</button><button className="primary-btn" disabled={disabled || !scene} onClick={() => { try { const events = JSON.parse(eventsText); if (!Array.isArray(events)) throw Error("Sự kiện phải là một mảng JSON"); command("scene.performance", { scene_id: scene?.id, events }); } catch (failure) { report(failure); } }}>Kiểm tra & lưu nhịp diễn</button></div></div>}
    {sourceOpen && <div className="panel visual-source"><label>Nhập nguồn zodiac-visual-intent@1<input type="file" accept=".json,application/json" onChange={e => e.target.files?.[0] && void loadSource(e.target.files[0])}/></label>
      <PagedText label="Canonical Visual Intent" size={900} text={sourceText} onChange={setSourceText}/>
      <div className="agent-actions"><button className="outline-btn" onClick={() => setSourceText("")}>Soạn nguồn thay thế</button><button className="outline-btn" onClick={() => setSourceText(JSON.stringify(state?.intent, null, 2) ?? "")}>Đọc nguồn hiện tại</button>
        <button className="primary-btn" disabled={disabled || !sourceText.trim()} onClick={() => { try { command("source.replace", { intent: JSON.parse(sourceText) }); } catch (failure) { report(failure); } }}>Lưu nguồn có kiểm tra</button></div>
      <small>Sửa từng trang nguồn. Để dán thay toàn bộ JSON, chọn “Soạn nguồn thay thế” trước hoặc nhập tệp JSON. Narration, receipt và voice giữ nguyên.</small></div>}
    {state?.job && <div className="voice-progress" data-job-state={state.job.status}><span>{state.job.message}</span><span>{state.job.status}{state.job.action === 'export' ? ` · HyperFrames MP4${state.job.render_percent === undefined ? '' : ` · ${state.job.render_percent}%`}` : ` · ${state.job.ready_scenes.length}/${state.job.total}`}</span>{state.job.error && <pre>{state.job.error}</pre>}</div>}
    {state?.stale_preview && <p className="voice-warning">Đang giữ preview tốt R{state.build?.revision}. Nguồn hiện tại R{state.revision}; dựng lại để xem thay đổi.</p>}
    <div className="visual-layout" hidden={sourceOpen || logOpen || galleryOpen || eventsOpen}><aside className="panel visual-scenes"><div className="panel-heading">Cảnh · {state?.intent?.scenes.length ?? 0}</div>
      <Paged size={3} label="Cảnh" revealIndex={state?.intent?.scenes.findIndex(s=>s.id===scene?.id)}>{(state?.intent?.scenes ?? []).map((item, index) => <button key={item.id} title={item.semantic_goal} className={scene?.id === item.id ? "active" : ""} onClick={() => chooseScene(item.id)}>
        <span>{String(index + 1).padStart(2, "0")} · {item.id}</span><small>{item.semantic_goal}</small><em>{state?.build?.scenes.some(s => s.id === item.id) ? "Preview có thật" : state?.job?.ready_scenes.includes(item.id) ? "Candidate đang build" : "Chưa dựng"}</em></button>)}</Paged>
      {!state?.intent && <p>Soạn bản dựng bằng agent ở phía trên, rồi dựng preview.</p>}</aside>
      <div className="panel visual-stage"><div className="panel-heading"><span>{scene?.id ?? "Preview"}</span><small>{preview ? `Build ${preview.build_id.slice(0, 8)} · R${preview.revision}` : "Chưa có output"}</small></div>
        <div className="visual-viewport" ref={viewport}>{preview ? <iframe key={preview.url} ref={iframe} src={preview.url} title={`HyperFrames ${scene?.id}`} sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer"
          style={{ width: 1080, height: 1920, transform: `scale(${scale})` }} onLoad={() => {setFrameReady(true); send("seek", { time: playhead.current });}}/>
          : <div className="voice-empty"><Layers3 size={36}/><p>Preview dùng SVG thật và timing ASR đã đo.</p><small>Tạo giọng và căn thời gian, sau đó dựng các cảnh để xem video.</small><button className="outline-btn" onClick={onVoice}>Chuẩn bị giọng đọc</button></div>}
          {preview && draft && mapped && !playing && !state?.stale_preview && <div className="visual-drag-box" aria-label={`Di chuyển ${entity?.id}`} role="button" tabIndex={0}
            style={{ left: `calc(50% - ${540 * scale}px + ${draft.x * scale}px)`, top: `calc(50% - ${960 * scale}px + ${draft.y * scale}px)`, width: draft.width * scale, height: draft.height * scale }}
            onPointerDown={e => { if (!disabled) { e.currentTarget.setPointerCapture(e.pointerId); pointer.current = { x: e.clientX, y: e.clientY, transform: { ...draft } }; } }}
            onPointerMove={e => { const p = pointer.current; if (p) setDraft({ ...p.transform, x: Math.round(p.transform.x + (e.clientX - p.x) / scale), y: Math.round(p.transform.y + (e.clientY - p.y) / scale) }); }}
            onPointerUp={() => { if (pointer.current && draft) { pointer.current = null; void commitTransform(draft); } }}
            onPointerCancel={() => { pointer.current = null; if (selected) setDraft({ ...selected.transform }); }}/>}</div>
        <div className="visual-transport"><button className="outline-btn" aria-label={playing ? "Tạm dừng cảnh" : "Phát từ cảnh này"} disabled={!preview || !duration || !!state?.stale_preview} onClick={() => {if(!playing && globalPlayhead.current>=episodeDuration)seekEpisode(0);setPlaying(!playing);}}>{playing ? <Pause size={16}/> : <Play size={16}/>}</button>
          <span>{time.toFixed(2)} / {duration.toFixed(2)}s</span><input type="range" aria-label="Measured scene timeline" min={0} max={duration || 1} step={1 / 30} value={time} onChange={e => { setPlaying(false); seek(Number(e.target.value)); }}/>
          <small>{audioUrl ? "Voice đã chọn" : "Preview không audio"}</small></div>{audioUrl && <audio ref={audio} src={audioUrl} preload="metadata"/>}
        <div className="visual-fidelity"><strong>{preview?.candidate_only ? "Candidate trong lúc dựng" : "Preview kỹ thuật"}</strong><span>SVG nguồn · timing ASR · chưa duyệt hình</span></div>
        {built && <><p className="voice-muted">Caption contrast {built.qa.caption_contrast.toFixed(1)}:1 · QA {built.qa.status} · {built.qa.issues.map(i => i.code).join(", ") || "Không có cảnh báo kỹ thuật"}</p>
          {built.qa.review_warnings?.length ? <p className="voice-warning">Cần xem diễn xuất: {built.qa.review_warnings.map(item => item.detail).join(" · ")}</p> : null}</>}</div>
      <aside className="panel visual-inspector"><div className="workspace-tabs" aria-label="Thuộc tính cảnh">{[["object", "Đối tượng"], ["events", "Sự kiện"], ["assets", "Hình ảnh"], ["agent", "Agent"]].map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>
        <div className="inspector-group" hidden={tab !== "object"}>
        <label>Đối tượng<select value={entity?.id ?? ""} onChange={e => { setEntityId(e.target.value); setStateId(""); }}>{scene?.entities.map(e => <option key={e.id} value={e.id}>{e.id} · {e.kind}</option>)}</select></label>
        <label>Trạng thái<select value={selectedStateId ?? ""} onChange={e => { setStateId(e.target.value); const map = sourceMap.find(m => m.entity_id === entity?.id && m.state_id === e.target.value); if (map) send("state", { hf_id: map.hf_id }); }}>{Object.keys(entity?.states ?? {}).map(id => <option key={id}>{id}</option>)}</select></label>
        {draft && <><div className="visual-transform">{(["x", "y", "width", "height", "rotation"] as const).map(key => <label key={key}>{{x:"Vị trí ngang",y:"Vị trí dọc",width:"Chiều rộng",height:"Chiều cao",rotation:"Góc xoay"}[key]}<input type="number" value={draft[key] ?? 0} disabled={disabled} onChange={e => setDraft({ ...draft, [key]: Number(e.target.value) })}/></label>)}</div>
          <button className="primary-btn" disabled={disabled || !sdkReady} onClick={() => void commitTransform(draft)}><Check size={15}/>Lưu & dựng cảnh</button></>}
        <details><summary>Nguồn đối tượng</summary><small>Asset {mapped?.asset_id ?? selected?.asset ?? "—"}</small><small>SHA {mapped?.source_sha256.slice(0, 16) ?? "Chưa dựng"}</small></details>
        </div><div className="visual-events" hidden={tab !== "events"}><strong>Voice reveals / events</strong><button className="outline-btn" disabled={!scene || disabled} onClick={() => { setEventsText(JSON.stringify(scene?.events ?? [], null, 2)); setEventsOpen(true); setGalleryOpen(false); setSourceOpen(false); setLogOpen(false); setPlaying(false); }}>Chỉnh nhịp diễn theo lời kể</button><Paged size={2} label="Sự kiện cảnh">{(scene?.events ?? []).map(e => <p key={e.id}>{e.id} · {e.target}<small>{e.state_before} → {e.state_after} · {e.trigger.text ?? e.trigger.type}</small></p>)}</Paged></div>
        <div className="visual-candidates" hidden={tab !== "assets"}><strong>Đạo cụ phù hợp với cảnh</strong><input aria-label="Asset constraints" value={query} placeholder="ID đạo cụ hoặc chọn từ Kho hình ảnh" onChange={e => setQuery(e.target.value)}/>
          <button className="outline-btn" disabled={!scene || disabled} onClick={() => { if (scene) void backend.visualCandidates(project.project_id, scene.id, query ? { asset_id: query } : {}).then(setCandidates).catch(report); }}>Tìm bundle phù hợp</button>
          <Paged size={1} label="Composition">{(candidates?.bundles ?? []).map(c => <div className="visual-candidate" key={c.candidate_id}><b>{c.asset_id}</b>{(()=>{const asset=galleryAssets.find(a=>a.id===c.asset_id || a.id===`prop:${c.asset_id}`);const src=asset?.preview_data_uri ?? (asset?.svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(asset.svg)}` : "");return src ? <img className="candidate-thumbnail" src={src} alt={`Đạo cụ ${c.asset_id}`}/> : <small>Chưa có ảnh xem trước cho lựa chọn này.</small>;})()}<small>{c.identity.model_id}</small><p>{c.fit_reasons.join(" · ")}</p>{c.warnings.map(w => <small key={w}>{w}</small>)}
            {!!c.usage?.length && <small>{c.usage.length} build kỹ thuật · chưa duyệt{candidates?.usage_evidence?.coverage?.truncated ? " · phạm vi quét giới hạn" : ""}</small>}
            <button className="outline-btn" disabled={disabled} onClick={() => command("asset.select", { scene_id: scene?.id, candidate_id: c.candidate_id, requirement: query ? { asset_id: query } : {} })}>Dùng composition</button></div>)}</Paged>
          {candidates?.new_asset_task && <p className="voice-warning">NO_FIT_ASSET · {candidates.new_asset_task.reason}</p>}
          {candidates?.usage_evidence?.coverage?.truncated && !candidates.bundles.some(c => c.usage?.length) && <small>Lịch sử: phạm vi quét giới hạn, tối đa 500 project / 50 build.</small>}
          {candidates && <details><summary>{candidates.rejected.length} lựa chọn bị loại</summary><Paged size={1} label="Lựa chọn bị loại">{candidates.rejected.map(r => <small key={r.id}>{r.id}: {r.reason}</small>)}</Paged></details>}</div>
        <div className="visual-candidates" hidden={tab !== "agent"}><strong>Agent · {scene?.id ?? "Chọn cảnh"}</strong>
          <small className="agent-connection-note">{connection?.available ? "Đã tìm thấy Codex" : "Chưa xác nhận Codex"} · {connection?.credential_available ? "Có cấu hình đăng nhập" : "Chưa xác nhận đăng nhập"}. Kết nối model được kiểm tra khi gửi yêu cầu.</small>
          <small>Đề xuất dùng kho hình hiện có. Bạn xem và áp dụng trước khi lưu.</small>
          <textarea aria-label="Yêu cầu agent chỉnh cảnh" value={agentInstruction} maxLength={1200} onChange={e => setAgentInstruction(e.target.value)} placeholder="Ví dụ: Dịch actor lead sang phải 40px, giữ kích thước"/>
          <button className="outline-btn" disabled={disabled || !scene || !agentInstruction.trim() || !!agentTask && ["STARTING", "RUNNING"].includes(agentTask.status)}
            onClick={() => scene && void backend.visualAgentStart(project.project_id, scene.id, agentInstruction).then(setAgentTask).catch(report)}>Đề xuất chỉnh sửa</button>
          {agentTask?.kind === "scene.propose" && agentTask.scene_id === scene?.id && <><AgentProposal task={agentTask}/>
            {["STARTING", "RUNNING"].includes(agentTask.status) && <button className="outline-btn" onClick={() => void backend.agentCancel(agentTask.task_id).then(setAgentTask).catch(report)}>Dừng agent</button>}
            <button className="primary-btn" disabled={disabled || agentTask.status !== "COMPLETED" || agentTask.write_applied} onClick={() => state && void action(async () => {
              const next = await backend.visualAgentApply(agentTask.task_id, state.revision);
              setAgentTask(await backend.agentTask(agentTask.task_id));
              return backend.episodeBuild(project.project_id, next.revision, agentTask.scene_id);
            })}>{agentTask.write_applied ? "Đã áp dụng đề xuất" : "Xác nhận edit & dựng cảnh"}</button></>}
        </div></aside></div>
    {!sourceOpen && !logOpen && !galleryOpen && !eventsOpen && <>
      {timelineResult.error && <p className="voice-warning">{timelineResult.error}</p>}
      <EpisodeTimeline scenes={timeline} sceneId={scene?.id} timeMs={episodeTime} playing={playing} canPlay={!!preview && frameReady && !state?.stale_preview} voice={voiceInfo} titles={Object.fromEntries((state?.intent?.scenes ?? []).map(s=>[s.id,s.semantic_goal]))} onSeek={at=>{setPlaying(false);seekEpisode(at);}} onPlay={()=>{if(!playing && globalPlayhead.current>=episodeDuration)seekEpisode(0);setPlaying(!playing);}}/>
    </>}
    {state?.build && <div className="visual-receipt">{state.build.scenes.length} scenes · {state.build.cache.reused} nodes cache / {state.build.cache.rebuilt} dựng lại · {(state.build.resources.wall_ms / 1000).toFixed(2)}s · {(state.build.resources.peak_rss_bytes / 1024 / 1024).toFixed(0)} MiB peak · Renderer parity: {state.build.renderer_parity}</div>}
    <button className="subtle-btn log-toggle" aria-expanded={logOpen} onClick={() => { setLogOpen(!logOpen); setSourceOpen(false); setGalleryOpen(false); setEventsOpen(false); }}>{logOpen ? "Đóng nhật ký" : "Hoạt động chỉnh sửa và build"}</button>
    {logOpen && <div className="panel visual-log"><Paged size={5} label="Nhật ký build">{(state?.events ?? []).slice().reverse().map(e => <p key={e.event_seq}>R{e.revision} · {e.kind} · {String(e.payload.scene_id ?? e.payload.build_id ?? "")}</p>)}</Paged></div>}
  </section>;
}
