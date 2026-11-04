// Pays out rewards through caller-supplied sinks and tallies them in a caller-owned plain object:
// stats = { [userId]: { [why|kind]: number } }.

export function createReward({ sinks = {}, stats = {} } = {}) {
  function grant(u, v, kind, n, why) {
    if (!Number.isFinite(n) || n <= 0) return 0;
    const sink = sinks[kind];
    if (typeof sink !== 'function') return 0;
    const given = sink(u, v, n, why);
    const got = given === undefined ? n : given;
    if (!Number.isFinite(got) || got === 0) return 0;
    const mine = (stats[u.userId] ??= {});
    mine[why] = (mine[why] ?? 0) + got;
    mine[kind] = (mine[kind] ?? 0) + got;
    return got;
  }
  const statsOf = userId => stats[userId] ?? {};
  return { grant, statsOf };
}
