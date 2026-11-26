import { shareRead } from "./rpc-reads";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { IdeaBoard, IdeaProgress, IdeaStatus } from "./idea-board";
import type { PipelineApi, PipelineData, PipelineEvidence, PipelineMode, RunRecord } from "./pipeline/types";

export type ProjectStatus = {
  project_id: string;
  content: string;
  voice: string;
  visual: string;
  video: string;
  published: string;
};
export type Project = {
  project_id: string;
  episode_id: string;
  display_title: string;
  sign: string | null;
  /** Concept code from the approved handoff (e.g. love-sincere); resolves to a title in the idea library. */
  concept_code?: string | null;
  source_sha256: string;
  revision: number;
  status: ProjectStatus;
};
export type StudioEvent = {
  project_id: string;
  command_id: string;
  event_seq: number;
  revision: number;
  kind: string;
  payload: Record<string, unknown>;
};
export type Asset = {
  id: string;
  role: string;
  contexts: string[];
  source: string;
  source_revision: string;
  sha256: string;
  available: boolean;
};
export type AssetCatalog = {
  format: string;
  total: number;
  ranked: boolean;
  selection: string;
  items: Asset[];
};
export type GalleryTheme = { id: string; title?: string; canvas: string; ink: string; accent: string; caption: string; caption_ink: string };
export type AssetUsage = { project_id: string; episode_id: string; build_id: string; manifest_sha256: string;
  source_sha256: string; review_status: "NOT_REVIEWED"; scene_ids: string[] };
export type GalleryAsset = { id: string; role: string; contexts: string[]; source_sha256: string;
  preview_data_uri?: string; svg?: string; path?: string; contact?: unknown; usage?: AssetUsage[];
  identity?: { family_id?: string; model_id?: string; state_id?: string; view_id?: string } };
export type AssetGalleryData = { format: string; source_revision: string; items: GalleryAsset[]; themes: GalleryTheme[];
  usage_evidence?: { coverage?: { truncated: boolean } } | null };
export type BackendHealth = {
  status: string;
  protocol: string;
  authority: string;
  scope: string[];
  approvals: string;
};
export type VoiceTake = {
  take_id: string; wav_sha256: string; duration_seconds: number; peaks: number[];
  warnings: string[]; details?: { voice: string; delivery_intent: string; prosody_verified: boolean };
  valid?: boolean; error?: string;
};
export type SpeechUnit = {
  id: string; text: string; source_range: [number, number]; selected_take: string | null;
  gap_after_ms: number; listened: { kind: string } | null; takes: VoiceTake[];
};
/** A review group of speech units (a plan scene, or a paragraph); `take` is the scene's joined audio once every unit has one. */
export type VoiceScene = { id: string; title: string; unit_ids: string[]; take: (VoiceTake & { take_id: string }) | null };
export type VoiceState = {
  project_id: string; narration_sha256: string; revision: number; voice: string; voices: string[]; status: string;
  scenes?: VoiceScene[];
  units: SpeechUnit[]; assembly: (VoiceTake & { listened: { kind: string } | null }) | null;
  timing: { words: { text: string; startMs: number; endMs: number; source_range: [number, number]; anchor_id: string }[]; duration_seconds: number } | null;
  job: { id: string; action: string; status: string; completed: number; total: number; message: string; error: string | null } | null;
  /** Why the listening approval was dropped by the last edit (cleared when the episode is heard again). */
  /** Unit ids whose take or pause the user has not heard yet. */
  segments_needing_listen?: string[];
  /** The whole episode was heard once and every current segment has a proof: the user may confirm the new assembly. */
  can_confirm_from_segments?: boolean;
  approval_note?: { reason: "take_changed" | "pause_changed" | "narration_changed" | "voice_changed"; unit_ids: string[]; at: number } | null;
};
export type AgentHealth = {
  model?: string; capabilities?: string[]; credential_available?: boolean; connection_status?: string; tools_enabled?: boolean;
  available: boolean;
  protocol: string;
  scope: string;
  active: number;
};
export type VisualTransform = { x: number; y: number; width: number; height: number; rotation?: number };
export type VisualEntity = { id: string; kind: string; initial_state: string; visual_role?: string;
  states: Record<string, { asset: string; transform: VisualTransform; visible?: boolean; opacity?: number; layer?: number }> };
export type VisualScene = { id: string; transition?: { preset: "cut" | "dissolve" | "paper-slide" | "page-turn"; frames: number }; semantic_goal: string; narration_range: [number, number]; entities: VisualEntity[];
  events: { id: string; target: string; state_before: string; state_after: string; trigger: { type: string; text?: string } }[] };
export type VisualIntent = { format: string; scenes: VisualScene[]; [key: string]: unknown };
export type BuiltScene = { id: string; start_ms: number; end_ms: number; duration_seconds: number; preview_sha256: string;
  source_map: { hf_id: string; scene_id: string; entity_id: string; state_id: string; asset_id: string; source_sha256: string }[];
  qa: { status: string; caption_contrast: number; issues: { code: string; entity_id?: string }[];
    review_warnings?: { code: string; detail: string }[] }; fidelity: string };
export type VisualState = { project_id: string; revision: number; source_hash: string | null; intent: VisualIntent | null;
  export?: VideoExport;
  theme: string; can_undo: boolean; can_redo: boolean; stale_preview: boolean;
  job: { id: string; action?: string; render_percent?: number; revision: number; status: string; ready_scenes: string[]; total: number; message: string; error: string | null } | null;
  build: { id: string; revision: number; voice_sha256: string; scenes: BuiltScene[]; theme: string; cache: { reused: number; rebuilt: number };
    resources: { wall_ms: number; peak_rss_bytes: number }; renderer_parity: string } | null;
  events: { event_seq: number; revision: number; kind: string; at: number; payload: Record<string, unknown> }[] };
export type VisualPreview = { url: string; html: string; sha256: string; scene: BuiltScene; build_id: string; revision: number; candidate_only: boolean; stale: boolean };
export type VideoExport = { id: string; revision: number; path: string; sha256: string; renderer: string;
  duration_seconds: number; bytes: number; human_review: string; approval_granted: false;
  audio_contract?: { mode: string; voice_sha256: string; music_tracks: number; sfx_tracks: number; sfx_cues?: number; mix_fingerprint?: string };
  cover_contract?: { mode: string; opening?: { sign: string; topic: string; series: string; duration_frames: number } };
  cover?: { source_frame?: number; sha256: string };
  url?: string; file_path?: string; stale?: boolean };
export type CandidateResult = { status: string; source_sha256: string; catalog_revision: string;
  usage_evidence?: { coverage?: { truncated: boolean } } | null;
  bundles: { candidate_id: string; asset_id: string; entity_id: string; actors: { entity_id: string; states: string[] }[];
    fit_reasons: string[]; warnings: string[]; usage?: AssetUsage[]; identity: { model_id: string; family_id: string } }[];
  rejected: { id: string; reason: string }[]; new_asset_task: { reason: string } | null };
export type AgentTask = {
  model?: string;
  validation_attempts?: {error: string; raw_output_sha256?: string; turn_id?: string; round?: number}[];
  /** Scene-by-scene authoring: one row per part (khung nhân vật, then each scene). */
  /** scene.revise: one Vietnamese line per change the agent proposes. */
  changes?: string[];
  parts?: {id: string; status: "RUNNING" | "DONE" | "FAILED"; seconds?: number; attempt?: number; error?: string}[];
  parts_total?: number;
  bound_fields?: string[]; raw_output_sha256?: string;
  task_id: string;
  project_id: string;
  project_revision: number;
  source_sha256: string;
  status: "STARTING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "INTERRUPTED";
  started_at: number;
  completed_at: number | null;
  thread_id: string | null;
  turn_id: string | null;
  preview: string;
  suggestion: string;
  error: string | null;
  kind: "project.inspect" | "scene.propose" | "scene.revise" | "episode.propose";
  visual_revision?: number;
  scene_id?: string;
  applied_command_id?: string | null;
  write_applied: boolean;
};
type RpcError = { code: string; stage: string; message: string };
type Envelope<T> = { id: string | null; ok: true; result: T } |
  { id: string | null; ok: false; error: RpcError };

export class BackendFailure extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "BackendFailure";
  }
}

export async function request<T>(method: string, params: object = {}): Promise<T> {
  if (!isTauri()) {
    throw new BackendFailure("DESKTOP_ONLY", "Mở bằng ứng dụng Tauri để kết nối Project Core.");
  }
  const envelope = await shareRead(method, params, () => invoke<Envelope<T>>("studio_request", { method, params }));
  if (!envelope.ok) {
    throw new BackendFailure(envelope.error.code, envelope.error.message);
  }
  return envelope.result;
}

export type StudioPreferences = {
  audio: { music_enabled: boolean; music_id: string; music_volume: number; sfx_enabled: boolean; sfx_id: string; sfx_volume: number; ducking: boolean };
  libraries: { music_dir: string; sfx_dir: string };
  agents: Record<string, { model: string; effort: string }>;
  voice: { default: string }; appearance: { theme: string };
};
export type StudioSettings = { revision: number; values: StudioPreferences; voices: string[]; themes: string[];
  effective_agents: StudioPreferences["agents"]; overrides: Record<string, { model: boolean; effort: boolean }>; system: Record<string, string | number> };
export type AudioAsset = { id: string; kind: "music" | "sfx"; title: string; url: string };
export const backend = {
  settings: () => request<StudioSettings>("settings.get"),
  saveSettings: (base_revision: number, values: StudioPreferences) => request<StudioSettings>("settings.update", { base_revision, values }),
  audioCatalog: () => request<{ items: AudioAsset[] }>("audio.catalog"),
  audioPreview: (project_id: string, build_id: string) => request<{ url: string; fingerprint: string; audio_contract: { music_tracks: number; sfx_tracks: number; sfx_cues: number } }>("audio.preview", { project_id, build_id }),
  pipelineGet: (project_id: string) => request<PipelineData>("pipeline.get", { project_id }),
  pipelineRun: (project_id: string, node_id: string, base_revision: number) =>
    request<PipelineData>("pipeline.run", { project_id, node_id, base_revision }),
  pipelineEvidence: (project_id: string) => request<PipelineEvidence>("pipeline.evidence", { project_id }),
  pipelineCardResolve: (project_id: string, scene_id: string, choice: string) =>
    request<{ scene_id: string; choice: string }>("pipeline.card.resolve", { project_id, scene_id, choice }),
  pipelineCancel: (project_id: string) => request<PipelineData>("pipeline.cancel", { project_id }),
  pipelineSetMode: (project_id: string, mode: PipelineMode) => request<{ mode: PipelineMode }>("pipeline.mode.set", { project_id, mode }),
  pipelineAutopilotStart: (project_id: string, base_revision: number) =>
    request<RunRecord>("pipeline.autopilot.start", { project_id, base_revision }),
  pipelineAutopilotStop: (project_id: string) => request<RunRecord>("pipeline.autopilot.stop", { project_id }),
  pipelinePlayback: (project_id: string, build_id: string) =>
    request<{ playback_id: string }>("pipeline.gate.playback", { project_id, gate: "visual_review", build_id }),
  pipelineConfirmVisual: (project_id: string, base_revision: number, build_id: string, playback_id: string) =>
    request<{ status: string; build_id: string; source_hash: string }>("pipeline.gate.confirm",
      { project_id, gate: "visual_review", base_revision, build_id, playback_id }),
  authorAgentStart: (project_id: string, instruction: string) => request<AgentTask>("agent.author.start", { project_id, instruction }),
  exportVideo: (project_id: string, base_revision: number) => request<VisualState>('video.export', { project_id, base_revision }),
  video: (project_id: string) => request<VideoExport>('video.get', { project_id }),
  revealVideo: (project_id: string) => request<{ folder: string; file: string }>('video.reveal', { project_id }),
  assetGallery: (project_id: string) => request<AssetGalleryData>("assets.gallery", { project_id }),
  ideas: () => request<IdeaBoard>("ideas.list"),
  ideaUpdate: (concept_id: string, sign: string, status: IdeaStatus) =>
    request<IdeaProgress>("ideas.update", { concept_id, sign, status }),
  visualOpen: (project_id: string) => request<VisualState>("visual.open", { project_id }),
  visualCommand: (project_id: string, base_revision: number, kind: string, payload: object, command_id = crypto.randomUUID()) =>
    request<VisualState>("visual.command", { project_id, base_revision, kind, payload, command_id }),
  episodeBuild: (project_id: string, base_revision: number, scene_id?: string) =>
    request<VisualState>(scene_id ? "scene.compile" : "episode.build", { project_id, base_revision, ...(scene_id ? { scene_id } : {}) }),
  visualCancel: (project_id: string) => request<VisualState>("visual.cancel", { project_id }),
  visualEpisodePreview: (project_id: string, build_id: string) =>
    request<{ html: string; build_id: string; duration_ms: number; stale: boolean }>("visual.episode_preview", { project_id, build_id }),
  visualPreview: (project_id: string, scene_id: string, build_id: string | null = null) => request<VisualPreview>("visual.preview", { project_id, scene_id, build_id }),
  visualCandidates: (project_id: string, scene_id: string, requirement: object) => request<CandidateResult>("assets.find_candidates", { project_id, scene_id, requirement }),
  visualAgentStart: (project_id: string, scene_id: string, instruction: string) => request<AgentTask>("agent.visual.start", { project_id, scene_id, instruction }),
  /** Revise one existing scene by ops (kind scene.revise). Rides on agent.author.start, which the desktop host already forwards. */
  reviseScene: (project_id: string, scene_id: string, instruction: string) => request<AgentTask>("agent.author.start", { project_id, scene_id, instruction }),
  visualAgentApply: (task_id: string, base_revision: number) => request<VisualState>("agent.apply", { task_id, base_revision, command_id: "agent-" + task_id, confirm: true }),
  voiceOpen: (project_id: string) => request<VoiceState>("voice.open", { project_id }),
  voiceStart: (project_id: string, base_revision: number, action: "generate" | "align", unit_ids: string[], voice: string, intent: string, pronunciation: Record<string, string>) =>
    request<VoiceState>("voice.start", { project_id, base_revision, action, unit_ids, voice, intent, pronunciation }),
  voiceCancel: (project_id: string) => request<VoiceState>("voice.cancel", { project_id }),
  voiceSelect: (project_id: string, base_revision: number, unit_id: string, take_id: string, gap_after_ms: number) =>
    request<VoiceState>("voice.select", { project_id, base_revision, unit_id, take_id, gap_after_ms }),
  voiceAssemble: (project_id: string, base_revision: number) => request<VoiceState>("voice.assemble", { project_id, base_revision }),
  voicePlayback: (project_id: string, unit_id: string, take_id: string) => request<{ playback_id: string }>("voice.playback", { project_id, unit_id, take_id }),
  voiceConfirm: (project_id: string, base_revision: number, unit_id: string, take_id: string, playback_id: string) =>
    request<VoiceState>("voice.confirm", { project_id, base_revision, unit_id, take_id, playback_id, confirm: true }),
  voiceAudio: async (project_id: string, unit_id: string, take_id: string): Promise<Blob> => {
    const chunks: ArrayBuffer[] = [];
    let offset = 0;
    do {
      const part = await request<{ data: string; total: number; offset: number }>("voice.audio", { project_id, unit_id, take_id, offset });
      const raw = atob(part.data);
      if (!raw.length) throw new BackendFailure("VOICE_AUDIO_TRUNCATED", "Không đọc đủ audio.");
      chunks.push(Uint8Array.from(raw, c => c.charCodeAt(0)).buffer);
      offset += raw.length;
      if (offset >= part.total) return new Blob(chunks, { type: "audio/wav" });
    } while (offset <= 64 * 1024 * 1024);
    throw new BackendFailure("VOICE_AUDIO_TOO_LARGE", "Audio quá lớn.");
  },
  health: () => request<BackendHealth>("health"),
  projects: async (): Promise<Project[]> => {
    const all: Project[] = [];
    let after: string | null = null;
    for (let page = 0; page < 100; page++) {
      const batch: Project[] = await request<Project[]>("projects.list", { limit: 100, after_project_id: after });
      all.push(...batch);
      if (batch.length < 100) return all;
      after = batch[batch.length - 1].project_id;
    }
    throw new BackendFailure("PROJECT_PAGE_LIMIT", "Too many projects for this Studio session.");
  },
  project: (project_id: string) => request<Project>("projects.open", { project_id }),
  importZip: (path: string) => request<Project>("projects.import", { path }),
  events: (project_id: string, after_seq = 0) =>
    request<StudioEvent[]>("events.list", { project_id, after_seq }),
  recentEvents: (project_id: string) =>
    request<StudioEvent[]>("events.recent", { project_id }),
  assets: (query = "", limit = 100) =>
    request<AssetCatalog>("assets.list", { query, limit }),
  agentHealth: () => request<AgentHealth>("agent.health"),
  agentStart: (project_id: string) => request<AgentTask>("agent.start", { project_id }),
  agentTask: (task_id: string) => request<AgentTask>("agent.task", { task_id }),
  agentTasks: (project_id: string) => request<AgentTask[]>("agent.tasks", { project_id }),
  agentCancel: (task_id: string) => request<AgentTask>("agent.cancel", { task_id }),
  agentApply: (task_id: string, base_revision: number) =>
    request<StudioEvent>("agent.apply", {
      task_id, confirm: true, base_revision, command_id: "agent-" + task_id,
    }),
  note: (project_id: string, revision: number, text: string) =>
    request<StudioEvent>("projects.command", {
      request: {
        project_id, command_id: "ui-" + crypto.randomUUID(),
        base_revision: revision, kind: "project.note", payload: { text },
      },
    }),
};

/** Adapter so the pipeline store depends on an interface, not on Tauri. */
export const pipelineApi: PipelineApi = {
  get: backend.pipelineGet,
  run: backend.pipelineRun,
  cancel: backend.pipelineCancel,
  resolveCard: backend.pipelineCardResolve,
  autopilotStart: backend.pipelineAutopilotStart,
  autopilotStop: backend.pipelineAutopilotStop,
  setMode: backend.pipelineSetMode,
};
