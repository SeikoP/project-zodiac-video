// A shared progress meter. `coop` fills up to `goal`; `versus` is a tug between two teams (first team pulls
// negative) clamped to [-clamp, clamp]. State is plain JSON in the caller: { value, power, names }.
// `power` is per user, `names` records which team each user last pushed for.

export function createMeter({ kind, goal = 0, clamp = 100, weights = {}, teams = [], balance = () => 1 }, state = {}) {
  state.value ??= 0;
  state.power ??= {};
  state.names ??= {};
  const versus = kind === 'versus';

  function add(userId, team, action, n = 1) {
    const w = weights[action];
    if (!w || (versus && !teams.includes(team))) return 0;
    const applied = w * n * (balance(team) ?? 1);
    if (!applied) return 0;
    if (versus) {
      const sign = team === teams[0] ? -1 : 1;
      state.value = Math.max(-clamp, Math.min(clamp, state.value + sign * applied));
    } else {
      state.value += applied;
    }
    state.power[userId] = (state.power[userId] ?? 0) + applied;
    state.names[userId] = team;
    return applied;
  }
  const value = () => state.value;
  const ratio = () => (versus ? (clamp ? Math.min(1, Math.abs(state.value) / clamp) : 0) : goal ? Math.min(1, state.value / goal) : 0);
  const powerOf = userId => state.power[userId] ?? 0;
  const sorted = ids => ids.map(id => [id, state.power[id]]).sort((a, b) => b[1] - a[1]);
  const top = k => sorted(Object.keys(state.power)).slice(0, k);
  const topBy = team => sorted(Object.keys(state.power).filter(id => state.names[id] === team))[0] ?? null;
  const reached = () => (versus ? Math.abs(state.value) >= clamp : goal > 0 && state.value >= goal);
  function reset() { state.value = 0; state.power = {}; state.names = {}; }
  return { add, value, ratio, powerOf, top, topBy, reached, reset };
}
