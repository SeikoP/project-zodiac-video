// Share only requests still in flight. Every later read sees current backend state.
const READS = new Set([
  "health", "projects.list", "projects.open", "events.list", "events.recent",
  "assets.list", "agent.health", "agent.task", "agent.tasks", "voice.open",
  "voice.audio", "visual.open", "pipeline.get", "pipeline.evidence", "video.get",
]);
const pending = new Map<string, Promise<unknown>>();

export function shareRead<T>(method: string, params: object, work: () => Promise<T>): Promise<T> {
  if (!READS.has(method)) return work();
  const key = JSON.stringify([method, params]);
  const existing = pending.get(key);
  if (existing) return existing as Promise<T>;
  const result = work().finally(() => pending.delete(key));
  pending.set(key, result);
  return result;
}
