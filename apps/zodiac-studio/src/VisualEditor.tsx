import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Composition } from "@hyperframes/sdk";
import { FileJson, Layers3, LoaderCircle, Pause, Play, RefreshCcw, Undo2 } from "lucide-react";
import { backend, type AgentTask, type CandidateResult, type Project, type VisualPreview, type VisualState, type VisualTransform, type VoiceState, type AgentHealth, type GalleryAsset } from "./backend";

import AssetGallery from "./AssetGallery";
import AgentProposal from "./AgentProposal";
import { BuildLog, EventsEditor, SourcePanel } from "./scene/OverlayPanels";
import { AgentTab, AssetsTab, EventsTab, ObjectTab, TransitionTab } from "./scene/InspectorTabs";
import { withTransition, withTransitionEverywhere } from "./scene/transition-edit";
import { buildBlockedText, buildJobMessage } from "./build-error";
import EpisodeTimeline from "./EpisodeTimeline";
import EpisodePlayer from "./EpisodePlayer";
import { episodePreview } from "./episode-preview-cache";
import {makeEpisodeTimeline, locateEpisodeTime} from "./episode-timeline";
import {createPlaybackClock} from "./playback-clock";
import type { WorkbenchSelection } from "./workbench-state";
import type { GraphTarget } from "./workbench-state";

export default function VisualEditor({ project, active = true, onBuildReady, selection, onSelectionChange, onVoice, graphTarget, contextPanel, voiceRefresh, agentRunning, sidePanelTop }: { project: Project | null; active?: boolean; onBuildReady?: (projectId: string, ready: boolean) => void; selection?: WorkbenchSelection; onSelectionChange?: (selection: WorkbenchSelection) => void; onVoice?: () => void; graphTarget?:GraphTarget; contextPanel?:ReactNode; voiceRefresh?:number; agentRunning?:boolean; sidePanelTop?:ReactNode }) {
  const [galleryOpen, setGalleryOpen] = useState(false), [eventsOpen, setEventsOpen] = useState(false), [eventsText, setEventsText] = useState("");
  const [dismissedTask,setDismissedTask]=useState<string | null>(null);
  const candidateRequest=useRef(0), candidateContext=useRef("");
  const candidateQuery=useRef("");
  const [connection,setConnection]=useState<AgentHealth | null>(null);
  const [galleryAssets,setGalleryAssets]=useState<GalleryAsset[]>([]);
  const [themes, setThemes] = useState<{ id: string; title?: string }[]>([]);
  const [technicalOpen,setTechnicalOpen]=useState(false);
  const [tab, setTab] = useState("agent"), [logOpen, setLogOpen] = useState(false);
  const [state, setState] = useState<VisualState | null>(null), [sceneId, setSceneId] = useState(selection?.sceneId ?? "");
  const [entityId, setEntityId] = useState(selection?.entityId ?? ""), [stateId, setStateId] = useState(selection?.stateId ?? "");
  const [preview, setPreview] = useState<VisualPreview | null>(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [sourceText, setSourceText] = useState(""), [sourceOpen, setSourceOpen] = useState(false);
  const [draft, setDraft] = useState<VisualTransform | null>(null), [candidates, setCandidates] = useState<CandidateResult | null>(null), [query, setQuery] = useState("");
  const [episodeTime,setEpisodeTime] = useState(selection?.timeMs ?? 0);
  const globalPlayhead = useRef(selection?.timeMs ?? 0);
  const [voiceInfo,setVoiceInfo] = useState<VoiceState | null>(null);
  const [previewAttempt,setPreviewAttempt]=useState(0);
  const previewCache=useRef(new Map<string,Promise<VisualPreview>>());
  const loadedFrames=useRef(new Set<string>());
  const [nextPreview,setNextPreview]=useState<VisualPreview | null>(null);
  const [frameReady,setFrameReady] = useState(false);
  const [time, setTime] = useState(0), [playing, setPlaying] = useState(false), [scale, setScale] = useState(.25);
  const [sdkReady, setSdkReady] = useState(false), [audioUrl, setAudioUrl] = useState(""), [wholeVideo, setWholeVideo] = useState(false), [wholeStart, setWholeStart] = useState(0), [wholePlay, setWholePlay] = useState(false);
  const [agentInstruction, setAgentInstruction] = useState(""), [agentTask, setAgentTask] = useState<AgentTask | null>(null);
  const iframe = useRef<HTMLIFrameElement>(null), viewport = useRef<HTMLDivElement>(null), sdk = useRef<Composition | null>(null);
  const loadedPreview = useRef<{ sha256: string; build_id: string; scene_id: string } | null>(null);
  const wholeTime = useRef(0), audio = useRef<HTMLAudioElement>(null), playhead = useRef(0), pointer = useRef<{ x: number; y: number; transform: VisualTransform } | null>(null);
  const projectId = project?.project_id, running = state?.job?.status === "RUNNING";
  const scene = state?.intent?.scenes.find(s => s.id === sceneId) ?? state?.intent?.scenes[0];
  candidateContext.current=`${projectId}:${state?.revision}:${scene?.id}`;candidateQuery.current=query;
  const entity = scene?.entities.find(e => e.id === entityId) ?? scene?.entities[0];
  const selectedStateId = entity?.states[stateId] ? stateId : entity?.initial_state;
  useEffect(() => {
    if(projectId && scene) onSelectionChange?.({projectId,sceneId:scene.id,entityId:entity?.id ?? null,timeMs:episodeTime,stateId:selectedStateId ?? null,eventId:graphTarget?.eventId ?? null,anchorId:graphTarget?.anchorId ?? null});
  },[projectId,scene?.id,entity?.id,selectedStateId,episodeTime,graphTarget?.eventId,graphTarget?.anchorId,onSelectionChange]);
  const selected = selectedStateId ? entity?.states[selectedStateId] : undefined;
  const built = state?.build?.scenes.find(s => s.id === scene?.id), sourceMap = preview?.scene?.source_map ?? [];
  const mapped = sourceMap.find(m => m.entity_id === entity?.id && m.state_id === selectedStateId);
  const candidateBuildId = scene && state?.job?.status === "RUNNING" && state.job.revision === state.revision && state.job.ready_scenes.includes(scene.id) ? state.job.id : null;
  const effectiveBuildId = candidateBuildId ?? state?.build?.id;
  const timelineResult = useMemo(() => {
    try { return {scenes:makeEpisodeTimeline(state?.build?.scenes ?? []),error:""}; }
    catch (e) { return {scenes:[],error:e instanceof Error ? e.message : String(e)}; }
  }, [state?.build?.scenes]);
  const timeline=timelineResult.scenes, episodeDuration=timeline.at(-1)?.endMs ?? (voiceInfo?.timing?.duration_seconds ?? 0)*1000;
  const stalePlayback=!!state?.intent && !!state.stale_preview;
  const inGap=timeline.length>0 && locateEpisodeTime(timeline,episodeTime)===null;
  useEffect(()=>{
    if(!state?.intent)return;
    const at=Math.max(0,Math.min(episodeDuration,globalPlayhead.current));
    const position=locateEpisodeTime(timeline,at);
    if(position && position.sceneId!==sceneId)setSceneId(position.sceneId);
    globalPlayhead.current=at;setEpisodeTime(at);
  },[state?.source_hash,state?.build?.id,episodeDuration]);
  useEffect(()=>{if(scene && entityId && !scene.entities.some(e=>e.id===entityId))setEntityId(scene?.entities[0]?.id ?? "");},[scene?.id,state?.source_hash,entityId]);
  const duration = preview?.scene?.duration_seconds ?? built?.duration_seconds ?? 0;
  useEffect(()=>{if(!active || !projectId)return;let live=true;
    void backend.agentHealth().then(h=>{if(live)setConnection(h);}).catch(()=>{if(live)setConnection(null);});
    return ()=>{live=false;};
  },[active,projectId]);
  const report = useCallback((value: unknown) => setError(value instanceof Error ? value.message : String(value)), []);
  useEffect(() => {
    if (projectId) onBuildReady?.(projectId, !!state?.build && !state.stale_preview);
  }, [projectId, state?.build?.id, state?.stale_preview, onBuildReady]);
  useEffect(() => { if (!active) { setPlaying(false); setWholePlay(false); audio.current?.pause(); } }, [active]);
  useEffect(() => {  // warm the whole-video page as soon as a fresh build exists, so pressing play finds it ready
    if (active && projectId && state?.build?.id && !state.stale_preview) void episodePreview(projectId, state.build.id).catch(() => undefined);
  }, [active, projectId, state?.build?.id, state?.stale_preview]);
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
  function cachedPreview(id: string) {
    const key=`${projectId}:${effectiveBuildId}:${id}`;
    let pending=previewCache.current.get(key);
    if(!pending){
      pending=backend.visualPreview(projectId!,id,effectiveBuildId!);
      previewCache.current.set(key,pending);
      void pending.catch(()=>previewCache.current.delete(key));
    }
    return pending;
  }
  useEffect(()=>{
    previewCache.current.clear();loadedFrames.current.clear();setNextPreview(null);
  },[projectId,effectiveBuildId]);
  useEffect(()=>{
    if(!active || !projectId || !effectiveBuildId || !scene)return;
    const index=timeline.findIndex(s=>s.id===scene.id), next=timeline[index+1];
    let live=true;
    if(next) void cachedPreview(next.id).then(p=>{if(live)setNextPreview(p);}).catch(()=>{if(live)setNextPreview(null);});
    else setNextPreview(null);
    // Retain only current and next scene payloads.
    for(const key of previewCache.current.keys()) if(key!==`${projectId}:${effectiveBuildId}:${scene.id}` && key!==`${projectId}:${effectiveBuildId}:${next?.id}`)previewCache.current.delete(key);
    return ()=>{live=false;};
  },[active,projectId,scene?.id,effectiveBuildId,previewAttempt]);
  useEffect(() => {
    if (!active) return;
    if (!projectId || !scene || !effectiveBuildId) {
      sdk.current?.dispose();sdk.current=null;loadedPreview.current=null;setPreview(null);setSdkReady(false);setPlaying(false);return;
    }
    let live=true;
    setFrameReady(false);setPreview(null);setSdkReady(false);
    void cachedPreview(scene.id).then(async next=>{
      if(!live)return;
      if(loadedPreview.current?.scene_id===scene.id && loadedPreview.current.sha256===next.sha256 && loadedPreview.current.build_id===next.build_id && sdk.current) {
        setPreview(next);setSdkReady(true);setFrameReady(loadedFrames.current.has(next.url));return;
      }
      const {openComposition}=await import("@hyperframes/sdk");
      const composition=await openComposition(next.html,{overrides:{},history:false});
      if(!live){composition.dispose();return;}
      sdk.current?.dispose();sdk.current=composition;
      const position=locateEpisodeTime(timeline,globalPlayhead.current);
      const at=position && position.sceneId===scene.id ? position.localMs/1000 : 0;
      loadedPreview.current={sha256:next.sha256,build_id:next.build_id,scene_id:scene.id};
      setPreview(next);setSdkReady(true);setFrameReady(loadedFrames.current.has(next.url));setTime(at);playhead.current=at;
    }).catch(failure=>{if(live){setPlaying(false);report(failure);}});
    return ()=>{live=false;};
  },[active,projectId,scene?.id,effectiveBuildId,candidateBuildId,previewAttempt,report]);
  useEffect(() => () => sdk.current?.dispose(), []);
  // A run started from the step list (not from this panel) is invisible to the local task state: follow it
  // while the graph says it is running, and once more when it stops so the finished proposal appears here.
  useEffect(() => {
    if (!projectId || !active) return;
    let live = true;
    const pull = () => backend.agentTasks(projectId).then(tasks => { if (live) setAgentTask(tasks.find(t => t.kind !== "project.inspect") ?? null); }).catch(failure => { if (live) report(failure); });
    void pull();
    if (!agentRunning) return () => { live = false; };
    const timer = window.setInterval(() => void pull(), 1500);
    return () => { live = false; window.clearInterval(timer); };
  }, [active, projectId, agentRunning, report]);
  useEffect(() => {
    if (!active || !agentTask || !["STARTING", "RUNNING"].includes(agentTask.status)) return;
    let live = true;
    const timer = window.setInterval(() => void backend.agentTask(agentTask.task_id).then(task => { if (live) setAgentTask(task); }).catch(failure => { if (live) report(failure); }), 1000);
    return () => { live = false; window.clearInterval(timer); };
  }, [active, agentTask?.task_id, agentTask?.status, report]);
  useEffect(() => {
    let live = true, local = "";
    setAudioUrl(""); setVoiceInfo(null);
    if (!active || !projectId || !state) return;
    void backend.voiceOpen(projectId).then(async voice => {
      if(live)setVoiceInfo(voice);
      if (!voice.assembly || voice.assembly.valid===false || (state.build && voice.assembly.wav_sha256 !== state.build.voice_sha256)) { if (live) setAudioUrl(""); return; }
      if (state.build?.id && !state.stale_preview) {
        const mix = await backend.audioPreview(projectId, state.build.id);
        if (live) setAudioUrl(mix.url);
        return;
      }
      local = URL.createObjectURL(await backend.voiceAudio(projectId, "episode", voice.assembly.take_id));
      if (live) setAudioUrl(local); else URL.revokeObjectURL(local);
    }).catch(failure => { if (live) report(failure); });
    return () => { live = false; if (local) URL.revokeObjectURL(local); };
  }, [active,projectId, !!state, state?.build?.id,state?.stale_preview,graphTarget?.stage,voiceRefresh,report]);
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
  useEffect(()=>{
    if(!preview || !frameReady || !active)return;
    const position=locateEpisodeTime(timeline,globalPlayhead.current);
    if(position && position.sceneId===preview.scene.id)send("seek",{time:position.localMs/1000});
  },[preview?.url,frameReady,active]);
  /** Playing the timeline uses the whole-video page (one composition, nothing loaded at a scene boundary); scene by scene is the fallback. */
  function startPlayback() {
    if (state?.build?.id && !state.stale_preview && projectId && audioUrl !== undefined && state.intent) {
      const from = globalPlayhead.current >= episodeDuration ? 0 : globalPlayhead.current;
      setPlaying(false); setWholeStart(from); setWholePlay(true); setWholeVideo(true);
      return;
    }
    if(!playing && globalPlayhead.current>=episodeDuration)seekEpisode(0);
    setPlaying(!playing);
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
  useEffect(()=>{
    if(!graphTarget)return;
    setPlaying(false);
    if(graphTarget.sceneId && graphTarget.sceneId!==scene?.id)chooseScene(graphTarget.sceneId);
    if(graphTarget.entityId)setEntityId(graphTarget.entityId);
    if(graphTarget.stateId)setStateId(graphTarget.stateId);
    if(graphTarget.eventId)setTab("more");
    else if(graphTarget.entityId)setTab("object");
    if(graphTarget.timeMs!==undefined)seekEpisode(graphTarget.timeMs);
  },[graphTarget]);
  useEffect(() => {setPlaying(false); audio.current?.pause();}, [state?.revision,state?.build?.id,state?.stale_preview]);
  useEffect(()=>{
    const player=audio.current;
    if(!playing || !active || stalePlayback){player?.pause();return;}
    if(player && audioUrl){player.currentTime=globalPlayhead.current/1000;void player.play().catch(e=>{setPlaying(false);report(e);});}
    return ()=>player?.pause();
  },[playing,active,audioUrl,stalePlayback,report]);
  useEffect(() => {
    if (!playing || !active || !episodeDuration || stalePlayback) return;
    let frame=0,painted=0;
    const steady=createPlaybackClock(globalPlayhead.current,audio.current && audioUrl ? ()=>audio.current ? audio.current.currentTime*1000 : null : null,performance.now());
    const tick=(now: number)=>{
      const at=Math.min(episodeDuration,steady.at(now));  // steady frame clock; the voice only corrects a real drift
      globalPlayhead.current=at;
      const position=locateEpisodeTime(timeline,at);
      if(position && position.sceneId!==scene?.id){setSceneId(position.sceneId);setEntityId("");setStateId("");}
      if(now-painted>=1000/30 || at>=episodeDuration){
        painted=now;setEpisodeTime(at);
        if(position && position.sceneId===preview?.scene.id && frameReady){playhead.current=position.localMs/1000;setTime(playhead.current);send("seek",{time:playhead.current});}
      }
      if(at>=episodeDuration)setPlaying(false);else frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);return ()=>cancelAnimationFrame(frame);
  },[playing,active,preview?.url,frameReady,audioUrl,episodeDuration,scene?.id,stalePlayback]);
  function findCandidates(requirement: object, expectedQuery=query) {
    if(!projectId || !scene)return;
    const request=++candidateRequest.current, context=candidateContext.current;
    void backend.visualCandidates(projectId,scene.id,requirement).then(result=>{
      if(request===candidateRequest.current && context===candidateContext.current && candidateQuery.current===expectedQuery)setCandidates(result);
    }).catch(failure=>{if(context===candidateContext.current && request===candidateRequest.current)report(failure);});
  }
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
  if (!project) return null; // EpisodeShell shows the empty state before this component is mounted

  return <section className="visual-editor" data-has-source={!!state?.intent}>
    <div className="hf-head" hidden={!technicalOpen}><span className="hf-brand"><Layers3 size={16}/><strong>Chọn cảnh · xem · chỉnh sửa</strong></span>
      <span className="status-chip status-neutral">R{state?.revision ?? 0} · {sdkReady ? "HyperFrames SDK" : "Canonical Visual Intent"}</span></div>
    {error && <div className="inline-alert error" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}
    <div className="visual-toolbar"><button className="outline-btn" onClick={() => { setGalleryOpen(!galleryOpen); setSourceOpen(false); setLogOpen(false); setEventsOpen(false); setPlaying(false); }}>Kho hình ảnh</button><button className="outline-btn" hidden={!technicalOpen} onClick={() => { setSourceOpen(!sourceOpen); setLogOpen(false); setGalleryOpen(false); setEventsOpen(false); }}><FileJson size={15}/>Nguồn Visual Intent</button>
      <button className="outline-btn" aria-pressed={wholeVideo} disabled={!state?.build?.id || !!state?.stale_preview} onClick={() => { setPlaying(false); if (wholeVideo) seekEpisode(wholeTime.current); else { setWholeStart(globalPlayhead.current); setWholePlay(false); } setWholeVideo(!wholeVideo); }}>{wholeVideo ? "Quay lại từng cảnh" : "Xem cả video"}</button>
      <button className="outline-btn" disabled={disabled || !state?.can_undo} onClick={() => command("undo", {})}><Undo2 size={15}/>Undo</button>
      <button className="outline-btn" disabled={disabled || !state?.can_redo} onClick={() => command("redo", {})}>Redo</button>
      <button className="outline-btn" aria-expanded={technicalOpen} onClick={()=>setTechnicalOpen(!technicalOpen)}>Chi tiết kỹ thuật</button>
      <label hidden={!technicalOpen}>Màu sắc<select value={state?.theme ?? "light"} disabled={disabled || !state?.intent} onChange={event => command("theme.select", { theme: event.target.value })}>
        {(themes.length ? themes : [{ id: "light", title: "Giấy sáng" }, { id: "dark", title: "Nền tối" }]).map(t => <option key={t.id} value={t.id}>{t.title ?? t.id}</option>)}</select></label>
      <button className="primary-btn" disabled={disabled || !state?.intent} onClick={() => state && void action(() => backend.episodeBuild(project.project_id, state.revision))}>
        {running ? <LoaderCircle size={15} className="spin"/> : <RefreshCcw size={15}/>}Dựng cả episode</button>
      {running && <button className="outline-btn" onClick={() => void action(() => backend.visualCancel(project.project_id))}>Dừng tác vụ</button>}</div>
    {galleryOpen && <button className="outline-btn gallery-back" onClick={()=>setGalleryOpen(false)}>Quay lại bàn dựng</button>}
    {galleryOpen && <AssetGallery projectId={projectId ?? null} onFind={id => {
      setGalleryOpen(false); setTab("more"); setQuery(id);
      if (scene) findCandidates({asset_id:id},id);
    }}/>}
    {eventsOpen && <EventsEditor scene={scene} text={eventsText} onText={setEventsText} disabled={disabled} onClose={() => setEventsOpen(false)}
      onSave={raw => { try { const events = JSON.parse(raw); if (!Array.isArray(events)) throw Error("Sự kiện phải là một mảng JSON"); command("scene.performance", { scene_id: scene?.id, events }); } catch (failure) { report(failure); } }}/>}
    {sourceOpen && <SourcePanel state={state} text={sourceText} onText={setSourceText} disabled={disabled} onFile={file => void loadSource(file)}
      onSave={raw => { try { command("source.replace", { intent: JSON.parse(raw) }); } catch (failure) { report(failure); } }}/>}
    {state?.job && <div className="voice-progress" data-job-state={state.job.status} data-job-id={state.job.id}><span>{buildJobMessage(state.job.message)}</span><span>{state.job.status}{state.job.action === 'export' ? ` · HyperFrames MP4${state.job.render_percent === undefined ? '' : ` · ${state.job.render_percent}%`}` : ` · ${state.job.ready_scenes.length}/${state.job.total}`}</span>{state.job.error && <details open={!!buildBlockedText(state.job.error).summary}><summary>{buildBlockedText(state.job.error).summary || "Không dựng được · xem nguyên nhân"}</summary><pre>{buildBlockedText(state.job.error).detail}</pre></details>}</div>}
    {state?.stale_preview && <p className="voice-warning">Đang giữ preview tốt R{state.build?.revision}. Nguồn hiện tại R{state.revision}; dựng lại để xem thay đổi.</p>}
    {wholeVideo && active && state?.build?.id && !state.stale_preview && projectId && <div className="panel visual-stage whole-video"><div className="panel-heading"><span>Cả video · có chuyển cảnh</span></div>
      <EpisodePlayer projectId={projectId} buildId={state.build.id} audioUrl={audioUrl} durationMs={episodeDuration} onError={report}
        startMs={wholeStart} autoplay={wholePlay} onTime={ms => { wholeTime.current = ms; }}/></div>}
    <div className="visual-layout" hidden={wholeVideo || sourceOpen || logOpen || galleryOpen || eventsOpen}>      <div className="panel visual-stage"><div className="panel-heading"><span>{scene ? `Xem trước · Cảnh ${(state?.intent?.scenes.findIndex(s => s.id === scene.id) ?? 0) + 1}/${state?.intent?.scenes.length ?? 0}` : "Xem trước"}</span><small>{scene?.semantic_goal ?? (preview ? "" : "Chưa dựng video")}</small></div>
        <div className="visual-viewport" ref={viewport}>{[preview,nextPreview].filter((p,i,a): p is VisualPreview=>!!p && a.findIndex(other=>other?.url===p.url)===i).map(p=>{
          const current=p.url===preview?.url;
          return <iframe key={p.url} ref={node=>{if(current)iframe.current=node;}} src={p.url} title={`HyperFrames ${p.scene.id}`} aria-hidden={!current || inGap} sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer"
            style={{width:1080,height:1920,transform:`scale(${scale})`,visibility:current && !inGap ? "visible":"hidden"}}
            onLoad={()=>{loadedFrames.current.add(p.url);if(current){setFrameReady(true);send("seek",{time:playhead.current});}}}/>;
        })}
          {inGap ? <div className="voice-empty"><strong>Khoảng nghỉ</strong><small>Không có cảnh tại vị trí này.</small></div> : !preview && <div className="voice-empty preview-empty-frame"><Layers3 size={36}/><p>{effectiveBuildId ? "Đang mở preview của cảnh" : state?.intent ? "Chưa dựng hình ảnh" : "Video của bạn sẽ hiện tại đây"}</p>
            {effectiveBuildId ? <button className="outline-btn" onClick={()=>{setError("");previewCache.current.delete(`${projectId}:${effectiveBuildId}:${scene?.id}`);setPreviewAttempt(a=>a+1);}}>Thử tải lại preview</button>
             : voiceInfo?.timing && state?.intent ? <button className="primary-btn" disabled={disabled} onClick={()=>state && void action(()=>backend.episodeBuild(project.project_id,state.revision))}>Dựng video để xem</button>
             : !state?.intent && voiceInfo?.timing ? <small>Nhờ Trợ lý dựng hình bên phải soạn các cảnh, rồi xem và áp dụng đề xuất.</small> : <button className="outline-btn" onClick={onVoice}>Chuẩn bị giọng đọc</button>}</div>}
          {!inGap && preview && draft && mapped && !playing && !state?.stale_preview && <div className="visual-drag-box" aria-label={`Di chuyển ${entity?.id}`} role="button" tabIndex={0}
            style={{ left: `calc(50% - ${540 * scale}px + ${draft.x * scale}px)`, top: `calc(50% - ${960 * scale}px + ${draft.y * scale}px)`, width: draft.width * scale, height: draft.height * scale }}
            onPointerDown={e => { if (!disabled) { e.currentTarget.setPointerCapture(e.pointerId); pointer.current = { x: e.clientX, y: e.clientY, transform: { ...draft } }; } }}
            onPointerMove={e => { const p = pointer.current; if (p) setDraft({ ...p.transform, x: Math.round(p.transform.x + (e.clientX - p.x) / scale), y: Math.round(p.transform.y + (e.clientY - p.y) / scale) }); }}
            onPointerUp={() => { if (pointer.current && draft) { pointer.current = null; void commitTransform(draft); } }}
            onPointerCancel={() => { pointer.current = null; if (selected) setDraft({ ...selected.transform }); }}/>}</div>
        <div className="visual-transport"><button className="outline-btn" aria-label={playing ? "Tạm dừng cảnh" : "Phát từ cảnh này"} disabled={!preview || !duration || !!state?.stale_preview} onClick={startPlayback}>{playing ? <Pause size={16}/> : <Play size={16}/>}</button>
          <span>{time.toFixed(2)} / {duration.toFixed(2)}s</span><input type="range" aria-label="Measured scene timeline" min={0} max={duration || 1} step={1 / 30} value={time} onChange={e => { setPlaying(false); seek(Number(e.target.value)); }}/>
          <small>{audioUrl ? "Voice đã chọn" : "Preview không audio"}</small></div>{audioUrl && <audio ref={audio} src={audioUrl} preload="metadata" onEnded={()=>{seekEpisode(episodeDuration);setPlaying(false);}}/>}
        <div className="visual-fidelity" hidden={!technicalOpen}><strong>{preview?.candidate_only ? "Candidate trong lúc dựng" : "Preview kỹ thuật"}</strong><span>SVG nguồn · timing ASR · chưa duyệt hình</span></div>
        {built && <><p className="voice-muted">Caption contrast {built.qa.caption_contrast.toFixed(1)}:1 · QA {built.qa.status} · {built.qa.issues.map(i => i.code).join(", ") || "Không có cảnh báo kỹ thuật"}</p>
          {built.qa.review_warnings?.length ? <p className="voice-warning">Cần xem diễn xuất: {built.qa.review_warnings.map(item => item.detail).join(" · ")}</p> : null}</>}</div>
      <aside className="panel visual-inspector" hidden={inGap && !contextPanel}>{!contextPanel && sidePanelTop}{contextPanel ?? <>    {!state?.intent && <div className="panel initial-authoring"><strong>Trợ lý dựng hình</strong>
      {!voiceInfo?.timing?.words.length && <p>Chuẩn bị giọng đọc và căn thời gian trước khi nhờ agent soạn hình. <button className="outline-btn" onClick={onVoice}>Mở phần giọng đọc</button></p>}<small>Model: {connection?.model || "Đang xác nhận"}</small><small>Agent dùng bản kể đã duyệt và timing của giọng đã chọn. Xem đề xuất trước khi áp dụng.</small><small className="style-note"><strong>Phong cách:</strong> hoạt hình 2D cắt giấy (limited cut-out). Chỉ phần mang nhịp mới chuyển động, đổi tư thế bằng cắt cứng; mỗi cảnh có 3 nhịp: ý định → hành động → phản ứng. Agent soạn từng cảnh, 2 agent chạy song song.</small>
      <textarea aria-label="Yêu cầu agent soạn hình ảnh" maxLength={1200} value={agentInstruction} onChange={e => setAgentInstruction(e.target.value)} placeholder="Diễn rõ lời bào chữa và bằng chứng phản bác, giữ phản ứng đủ đọc."/>
      <button className="primary-btn" disabled={!state || !voiceInfo?.assembly || !voiceInfo?.timing?.words.length || disabled || !!agentTask && ["STARTING", "RUNNING"].includes(agentTask.status)} onClick={() => void backend.authorAgentStart(project.project_id, agentInstruction.trim() || "Dựng các cảnh theo narrative plan đã duyệt, có hành động và phản ứng rõ.").then(setAgentTask).catch(report)}>Soạn bản dựng ban đầu</button>
      {agentTask?.kind === "episode.propose" && dismissedTask!==agentTask.task_id && <><AgentProposal task={agentTask}/>{agentTask.status === "COMPLETED" && !agentTask.write_applied && <button className="outline-btn" onClick={()=>setDismissedTask(agentTask.task_id)}>Bỏ đề xuất</button>}
        {["STARTING", "RUNNING"].includes(agentTask.status) && <button className="outline-btn" onClick={() => void backend.agentCancel(agentTask.task_id).then(setAgentTask).catch(report)}>Dừng agent</button>}
        <button className="primary-btn" disabled={disabled || agentTask.status !== "COMPLETED" || agentTask.write_applied} onClick={() => state && void action(async () => {
          const next = await backend.visualAgentApply(agentTask.task_id, state.revision);
          setAgentTask(await backend.agentTask(agentTask.task_id));
          return next;
        })}>Áp dụng bản dựng đề xuất</button></>}
    </div>}
<div className="workspace-tabs" aria-label="Thuộc tính cảnh">{[["agent", "Sửa cảnh"], ["object", "Đối tượng"], ["more", "Nâng cao"]].map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>
        <div hidden={tab !== "object"}><ObjectTab scene={scene} entity={entity} stateId={selectedStateId} selectedAsset={selected?.asset} mapped={mapped} draft={draft} disabled={disabled} sdkReady={sdkReady}
          onEntity={id => { setEntityId(id); setStateId(""); }}
          onState={id => { setStateId(id); const map = sourceMap.find(m => m.entity_id === entity?.id && m.state_id === id); if (map) send("state", { hf_id: map.hf_id }); }}
          onDraft={setDraft} onCommit={value => void commitTransform(value)}/></div>
        <div hidden={tab !== "more"}><h4 className="more-title">Sự kiện</h4><EventsTab scene={scene} disabled={disabled} onEdit={() => { setEventsText(JSON.stringify(scene?.events ?? [], null, 2)); setEventsOpen(true); setGalleryOpen(false); setSourceOpen(false); setLogOpen(false); setPlaying(false); }}/></div>
        <div hidden={tab !== "more"}><h4 className="more-title">Hình ảnh thay thế</h4><AssetsTab scene={scene} disabled={disabled} query={query} onQuery={setQuery} candidates={candidates} galleryAssets={galleryAssets}
          onFind={() => { if (scene) findCandidates(query ? { asset_id: query } : {}); }}
          onUse={candidateId => command("asset.select", { scene_id: scene?.id, candidate_id: candidateId, requirement: query ? { asset_id: query } : {} })}/></div>
        <div hidden={tab !== "more"}><h4 className="more-title">Chuyển cảnh</h4><TransitionTab scene={scene} isLast={!!state?.intent && state.intent.scenes.at(-1)?.id === scene?.id} disabled={disabled}
          onSet={transition => state?.intent && scene && command("source.replace", { intent: withTransition(state.intent, scene.id, transition) })}
          onSetEverywhere={transition => state?.intent && command("source.replace", { intent: withTransitionEverywhere(state.intent, transition) })}/></div>
        <div hidden={tab !== "agent"}><AgentTab scene={scene} connection={connection} instruction={agentInstruction} onInstruction={setAgentInstruction} task={agentTask} dismissedTask={dismissedTask} disabled={disabled}
          onDismiss={setDismissedTask}
          onStart={() => scene && void backend.reviseScene(project.project_id, scene.id, agentInstruction).then(setAgentTask).catch(report)}
          onCancel={taskId => void backend.agentCancel(taskId).then(setAgentTask).catch(report)}
          onApply={task => state && void action(async () => {
            const next = await backend.visualAgentApply(task.task_id, state.revision);
            setAgentTask(await backend.agentTask(task.task_id));
            return backend.episodeBuild(project.project_id, next.revision, task.scene_id);
          })}/></div>
        </>}</aside></div>
    {!sourceOpen && !logOpen && !galleryOpen && !eventsOpen && <>
      {timelineResult.error && <p className="voice-warning">{timelineResult.error}</p>}
      {!wholeVideo && <EpisodeTimeline scenes={timeline} sceneId={inGap ? undefined : scene?.id} timeMs={episodeTime} playing={playing} canPlay={(state?.intent ? !!preview && frameReady : !!audioUrl) && !stalePlayback && graphTarget?.stage !== 'voice' && graphTarget?.stage !== 'export'} voice={voiceInfo} titles={Object.fromEntries((state?.intent?.scenes ?? []).map(s=>[s.id,s.semantic_goal]))} onSeek={at=>{setPlaying(false);seekEpisode(at);}} onPlay={startPlayback}/>}
    </>}
    {technicalOpen && state?.build && <div className="visual-receipt">{state.build.scenes.length} scenes · {state.build.cache.reused} nodes cache / {state.build.cache.rebuilt} dựng lại · {(state.build.resources.wall_ms / 1000).toFixed(2)}s · {(state.build.resources.peak_rss_bytes / 1024 / 1024).toFixed(0)} MiB peak · Renderer parity: {state.build.renderer_parity}</div>}
    <button className="subtle-btn log-toggle" hidden={!technicalOpen} aria-expanded={logOpen} onClick={() => { setLogOpen(!logOpen); setSourceOpen(false); setGalleryOpen(false); setEventsOpen(false); }}>{logOpen ? "Đóng nhật ký" : "Hoạt động chỉnh sửa và build"}</button>
    {logOpen && <BuildLog events={state?.events ?? []}/>}
  </section>;
}
