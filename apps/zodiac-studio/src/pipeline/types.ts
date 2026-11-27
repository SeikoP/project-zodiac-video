export type NodeStatus = "PENDING" | "READY" | "RUNNING" | "DONE" | "FAILED" | "STALE" | "BLOCKED" | "AWAITING_USER";
export type NodeKind = "step" | "gate" | "fan";
export type PipelineMode = "autopilot" | "confirm";

export type PipelineNode = {
  id: string;
  title: string;
  kind: NodeKind;
  status: NodeStatus;
  inputs: string[];
  detail: string;
  scene_id: string | null;
};

export type PipelineIssue = {
  code: string;
  owner: string;
  scene_id: string | null;
  message: string;
  repair_group: string;
};

export type NeedsYou = {
  node_id: string;
  kind: "gate" | "blocked" | "failed";
  title: string;
  detail: string;
  issues: PipelineIssue[];
};

export type RunState = "IDLE" | "RUNNING" | "WAITING_GATE" | "WAITING_USER" | "DONE" | "STOPPED";
export type RunRecord = {
  format: string;
  run_id: string;
  state: RunState;
  node: string | null;
  needs_you: NeedsYou[];
  log: { at: number; node: string | null; text: string }[];
};

/** An open question the authoring chain could not settle itself; `default` keeps the scene as it is. */
export type OwnerCard = { scene_id: string; reason: string; options: string[]; default: string };

export type PipelineData = {
  format: string;
  project_id: string;
  revision: number;
  revisions: { visual: number; voice: number };
  mode: PipelineMode;
  run: RunRecord | null;
  nodes: PipelineNode[];
  cards?: OwnerCard[];
  build_id?: string | null;
};

/** Transport seam: the store never imports the Tauri backend, so it stays testable in Node. */
export type PipelineApi = {
  get(projectId: string): Promise<PipelineData>;
  run(projectId: string, nodeId: string, baseRevision: number): Promise<PipelineData>;
  cancel(projectId: string): Promise<PipelineData>;
  autopilotStart(projectId: string, baseRevision: number): Promise<RunRecord>;
  autopilotStop(projectId: string): Promise<RunRecord>;
  setMode(projectId: string, mode: PipelineMode): Promise<{ mode: PipelineMode }>;
  resolveCard(projectId: string, sceneId: string, choice: string): Promise<unknown>;
  discardAuthoring(projectId: string, resetSource?: boolean): Promise<unknown>;
};

export type Selection = { nodeId: string | null; sceneId: string | null };

export type PipelineEvidence = {
  build_id: string | null;
  revision: number | null;
  source_hash: string | null;
  checks: { ok: boolean; issues: PipelineIssue[]; receipt_sha256: string } | null;
  inspect: { build_id: string; method: string; findings: { scene_id: string; severity: "ok" | "warn" | "fail"; note: string }[] } | null;
  cover: { headline?: string; scene_id?: string } | null;
  publish: { title?: string; description?: string; hashtags?: string[]; cover_hook?: string; alt_hooks?: string[]; search_keyword?: string } | null;
};
