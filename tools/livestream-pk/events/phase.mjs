// Warmup -> run -> ended clock for an event. State is plain JSON in the caller: { startedAt, stage }.
// `stage` is the last stage reported, so tick() announces each transition once, even across a reload.

export function createPhase({ now, warmupMs = 0, runMs }, state = {}) {
  const runStart = () => state.startedAt + warmupMs;
  function start() {
    state.startedAt = now();
    state.stage = warmupMs > 0 ? 'warmup' : 'run';
  }
  function tick() {
    if (state.stage === 'warmup' && now() >= runStart()) { state.stage = 'run'; return 'run'; }
    if (state.stage === 'run' && now() >= runStart() + runMs) { state.stage = 'ended'; return 'ended'; }
    return null;
  }
  const phase = () => state.stage ?? 'idle';
  function msLeft() {
    if (state.stage === 'warmup') return runMs;
    if (state.stage === 'run') return Math.max(0, runStart() + runMs - now());
    return 0;
  }
  function warmupLeft() {
    return state.stage === 'warmup' ? Math.max(0, runStart() - now()) : 0;
  }
  function stop() { state.stage = 'idle'; delete state.startedAt; }
  return { start, tick, phase, msLeft, warmupLeft, stop };
}
