import { RUNNABLE } from "./status.ts";
import type { NeedsYou, OwnerCard, PipelineApi, PipelineData, PipelineMode, PipelineNode, RunRecord, Selection } from "./types.ts";

export const POLL_RUNNING_MS = 1500;
export const POLL_IDLE_MS = 12000; // each read costs the backend ~2 s of file checks: ask less often while nothing runs

export type PipelineSnapshot = {
  status: "idle" | "ready" | "error";
  error: string | null;
  data: PipelineData | null;
  nodes: PipelineNode[];
  revision: number;
  mode: PipelineMode;
  run: RunRecord | null;
  needsYou: NeedsYou[];
  cards: OwnerCard[];
  buildId: string | null;
  selection: Selection;
};

export type Timers = { set(fn: () => void, ms: number): unknown; clear(id: unknown): void };
const REQUEST_TIMEOUT_MS = 12000;

export type Visibility = { isHidden(): boolean; subscribe(cb: () => void): () => void };

export type PipelineStoreOptions = { projectId: string; timer?: Timers; visibility?: Visibility };

const EMPTY: PipelineSnapshot = {
  status: "idle", error: null, data: null, nodes: [], revision: 0, mode: "confirm", run: null, needsYou: [], cards: [], buildId: null,
  selection: { nodeId: null, sceneId: null },
};

const browserTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

const browserVisibility: Visibility = {
  isHidden: () => typeof document !== "undefined" && document.hidden,
  subscribe: (cb) => {
    if (typeof document === "undefined") return () => {};
    document.addEventListener("visibilitychange", cb);
    return () => document.removeEventListener("visibilitychange", cb);
  },
};

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const isBusy = (data: PipelineData | null) =>
  Boolean(data && (data.nodes.some((n) => n.status === "RUNNING") || data.run?.state === "RUNNING"));

export function createPipelineStore(api: PipelineApi, options: PipelineStoreOptions) {
  const timer = options.timer ?? browserTimers;
  const visibility = options.visibility ?? browserVisibility;
  const { projectId } = options;
  const listeners = new Set<() => void>();
  let snapshot: PipelineSnapshot = EMPTY;
  let signature = "";
  let sequence = 0;
  let applied = 0;
  let pending: unknown = null;
  let disposed = false;

  const emit = () => listeners.forEach((listener) => listener());
  const set = (next: PipelineSnapshot) => {
    snapshot = next;
    emit();
  };

  const schedule = () => {
    if (pending !== null) timer.clear(pending);
    pending = null;
    if (disposed || visibility.isHidden()) return;
    pending = timer.set(() => { pending = null; void refresh(); }, isBusy(snapshot.data) ? POLL_RUNNING_MS : POLL_IDLE_MS);
  };

  const apply = (data: PipelineData, ticket: number) => {
    if (disposed || ticket < applied) return; // an older response must never overwrite newer data
    applied = ticket;
    const next = JSON.stringify(data);
    if (next === signature && snapshot.error === null) return; // identical payload: keep snapshot identity
    signature = next;
    const keep = snapshot.selection.nodeId && data.nodes.some((n) => n.id === snapshot.selection.nodeId)
      ? snapshot.selection : EMPTY.selection;
    set({ status: "ready", error: null, data, nodes: data.nodes, revision: data.revision, mode: data.mode, run: data.run,
      needsYou: data.run?.needs_you ?? [], cards: data.cards ?? [], buildId: data.build_id ?? null, selection: keep });
  };

  const fail = (error: unknown) => {
    set({ ...snapshot, status: snapshot.data ? "ready" : "error", error: message(error) });
  };

  // A request that never answers (backend still starting) must not stop polling: give up, show the error, retry on schedule.
  const withTimeout = <T,>(work: Promise<T>, ms: number) => new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("Backend chưa trả lời, đang thử lại…")), ms);
    work.then((value) => { clearTimeout(id); resolve(value); }, (error) => { clearTimeout(id); reject(error); });
  });

  async function refresh(): Promise<void> {
    if (disposed) return;
    const ticket = ++sequence;
    try {
      apply(await withTimeout(api.get(projectId), REQUEST_TIMEOUT_MS), ticket);
    } catch (error) {
      if (!disposed && ticket >= applied) { applied = ticket; fail(error); }
    }
    schedule();
  }

  async function act(work: () => Promise<unknown>): Promise<boolean> {
    try {
      await work();
    } catch (error) {
      fail(error);
      return false;
    }
    await refresh();
    return true;
  }

  let unsubscribeVisibility: (() => void) | null = null;
  /**
   * Start reacting to visibility (pause when hidden, refresh when shown) and resume polling. Returns a
   * disconnect function. Safe to call again after disconnecting, which React StrictMode does on purpose.
   */
  const connect = () => {
    disposed = false;
    unsubscribeVisibility?.();
    unsubscribeVisibility = visibility.subscribe(() => {
      if (visibility.isHidden()) {
        if (pending !== null) timer.clear(pending);
        pending = null;
      } else {
        void refresh();
      }
    });
    return () => {
      disposed = true;
      if (pending !== null) timer.clear(pending);
      pending = null;
      unsubscribeVisibility?.();
      unsubscribeVisibility = null;
    };
  };
  connect();

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getSnapshot: () => snapshot,
    refresh,
    async run(nodeId: string): Promise<boolean> {
      const node = snapshot.nodes.find((n) => n.id === nodeId);
      if (node?.kind === "gate") throw new Error("PIPELINE_GATE_USER_ONLY: bước duyệt chỉ người dùng xác nhận");
      return act(() => api.run(projectId, nodeId, snapshot.revision));
    },
    select(nodeId: string | null) {
      const node = nodeId ? snapshot.nodes.find((n) => n.id === nodeId) : null;
      const selection: Selection = node ? { nodeId: node.id, sceneId: node.scene_id } : EMPTY.selection;
      set({ ...snapshot, selection });
    },
    /** The owner's explicit "Soạn lại từ đầu": forgets the scenes already authored, so the next run starts from the cast. */
    discardAuthoring: (resetSource = false) => act(() => api.discardAuthoring(projectId, resetSource)),
    /** Records the owner's answer to a card (never an approval); the chain reads it the next time it runs. */
    resolveCard: (sceneId: string, choice: string) => act(() => api.resolveCard(projectId, sceneId, choice)),
    /** Builds every scene that can be built, one after another (the backend runs one job at a time). Stops at the first failure. */
    async runScenes(): Promise<boolean> {
      for (;;) {
        const next = snapshot.nodes.find((n) => n.id.startsWith("scene:") && RUNNABLE.includes(n.status));
        if (!next) return true;
        if (!(await act(() => api.run(projectId, next.id, snapshot.revision)))) return false;
        for (let i = 0; i < 600 && snapshot.nodes.some((n) => n.status === "RUNNING"); i += 1) {
          await new Promise<void>((resolve) => { timer.set(resolve, 1000); });
          await refresh();
        }
        if (snapshot.nodes.find((n) => n.id === next.id)?.status === "FAILED") return false;
      }
    },
    cancel: () => act(() => api.cancel(projectId)),
    startAutopilot: () => act(() => api.autopilotStart(projectId, snapshot.revision)),
    stopAutopilot: () => act(() => api.autopilotStop(projectId)),
    setMode: (mode: PipelineMode) => act(() => api.setMode(projectId, mode)),
    connect,
    dispose() {
      disposed = true;
      if (pending !== null) timer.clear(pending);
      pending = null;
      unsubscribeVisibility?.();
      unsubscribeVisibility = null;
      listeners.clear();
    },
  };
}

export type PipelineStore = ReturnType<typeof createPipelineStore>;
