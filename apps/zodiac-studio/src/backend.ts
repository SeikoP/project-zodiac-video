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
  assets: (query = "", limit = 100) =>
    request<AssetCatalog>("assets.list", { query, limit }),
  note: (project_id: string, revision: number, text: string) =>
    request<StudioEvent>("projects.command", {
      request: {
        project_id, command_id: "ui-" + crypto.randomUUID(),
        base_revision: revision, kind: "project.note", payload: { text },
      },
    }),
};
