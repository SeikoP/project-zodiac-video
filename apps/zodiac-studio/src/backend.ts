import { invoke, isTauri } from "@tauri-apps/api/core";

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
export type VoiceState = {
  project_id: string; narration_sha256: string; revision: number; voice: string; voices: string[]; status: string;
  units: SpeechUnit[]; assembly: (VoiceTake & { listened: { kind: string } | null }) | null;
  timing: { words: { text: string; startMs: number; endMs: number; source_range: [number, number]; anchor_id: string }[]; duration_seconds: number } | null;
  job: { id: string; action: string; status: string; completed: number; total: number; message: string; error: string | null } | null;
};
export type AgentHealth = {
  available: boolean;
  protocol: string;
  scope: string;
  active: number;
};
export type VisualTransform = { x: number; y: number; width: number; height: number; rotation?: number };
export type VisualEntity = { id: string; kind: string; initial_state: string; visual_role?: string;
  states: Record<string, { asset: string; transform: VisualTransform; visible?: boolean; opacity?: number; layer?: number }> };
export type VisualScene = { id: string; semantic_goal: string; narration_range: [number, number]; entities: VisualEntity[];
  events: { id: string; target: string; state_before: string; state_after: string; trigger: { type: string; text?: string } }[] };
export type VisualIntent = { format: string; scenes: VisualScene[]; [key: string]: unknown };
export type BuiltScene = { id: string; start_ms: number; end_ms: number; duration_seconds: number; preview_sha256: string;
  source_map: { hf_id: string; scene_id: string; entity_id: string; state_id: string; asset_id: string; source_sha256: string }[];
  qa: { status: string; caption_contrast: number; issues: { code: string; entity_id?: string }[] }; fidelity: string };
export type VisualState = { project_id: string; revision: number; source_hash: string | null; intent: VisualIntent | null;
  theme: "light" | "dark"; can_undo: boolean; can_redo: boolean; stale_preview: boolean;
  job: { id: string; status: string; ready_scenes: string[]; total: number; message: string; error: string | null } | null;
  build: { id: string; revision: number; voice_sha256: string; scenes: BuiltScene[]; theme: string; cache: { reused: number; rebuilt: number };
    resources: { wall_ms: number; peak_rss_bytes: number }; renderer_parity: string } | null;
  events: { event_seq: number; revision: number; kind: string; at: number; payload: Record<string, unknown> }[] };
export type VisualPreview = { url: string; html: string; sha256: string; scene: BuiltScene; build_id: string; revision: number; candidate_only: boolean; stale: boolean };
export type CandidateResult = { status: string; source_sha256: string; catalog_revision: string;
  bundles: { candidate_id: string; asset_id: string; entity_id: string; actors: { entity_id: string; states: string[] }[];
    fit_reasons: string[]; warnings: string[]; identity: { model_id: string; family_id: string } }[];
  rejected: { id: string; reason: string }[]; new_asset_task: { reason: string } | null };
export type AgentTask = {
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
  kind: "project.inspect" | "scene.propose";
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
  const envelope = await invoke<Envelope<T>>("studio_request", { method, params });
  if (!envelope.ok) {
    throw new BackendFailure(envelope.error.code, envelope.error.message);
  }
  return envelope.result;
}

export const backend = {
  visualOpen: (project_id: string) => request<VisualState>("visual.open", { project_id }),
  visualCommand: (project_id: string, base_revision: number, kind: string, payload: object, command_id = crypto.randomUUID()) =>
    request<VisualState>("visual.command", { project_id, base_revision, kind, payload, command_id }),
  episodeBuild: (project_id: string, base_revision: number, scene_id?: string) =>
    request<VisualState>(scene_id ? "scene.compile" : "episode.build", { project_id, base_revision, ...(scene_id ? { scene_id } : {}) }),
  visualCancel: (project_id: string) => request<VisualState>("visual.cancel", { project_id }),
  visualPreview: (project_id: string, scene_id: string, build_id: string | null = null) => request<VisualPreview>("visual.preview", { project_id, scene_id, build_id }),
  visualCandidates: (project_id: string, scene_id: string, requirement: object) => request<CandidateResult>("assets.find_candidates", { project_id, scene_id, requirement }),
  visualAgentStart: (project_id: string, scene_id: string, instruction: string) => request<AgentTask>("agent.visual.start", { project_id, scene_id, instruction }),
  visualAgentApply: (task_id: string, base_revision: number) => request<VisualState>("agent.apply", { task_id, base_revision, command_id: crypto.randomUUID(), confirm: true }),
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
