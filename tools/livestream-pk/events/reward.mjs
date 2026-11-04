// Pays out rewards through caller-supplied sinks and tallies them in a caller-owned plain object:
// stats = { [userId]: { [why|kind]: number } }. A caller that keeps its numbers elsewhere (the profile keeps them inside each
// viewer, so a restart keeps them) passes tally(userId) -> the object to count in; onGrant(u, v, kind, got, why) hears every
// payout that went through.

export function createReward({ sinks = {}, stats = {}, tally = null, onGrant = null } = {}) {
  const bucket = userId => (tally ? tally(userId) : (stats[userId] ??= {}));
  function grant(u, v, kind, n, why) {
    if (!Number.isFinite(n) || n <= 0) return 0;
    const sink = sinks[kind];
    if (typeof sink !== 'function') return 0;
    const given = sink(u, v, n, why);
    const got = given === undefined ? n : given;
    if (!Number.isFinite(got) || got === 0) return 0;
    const mine = bucket(u.userId);
    mine[why] = (mine[why] ?? 0) + got;
    mine[kind] = (mine[kind] ?? 0) + got;
    if (onGrant) onGrant(u, v, kind, got, why);
    return got;
  }
  const statsOf = userId => (tally ? tally(userId) : stats[userId]) ?? {};
  return { grant, statsOf };
}
