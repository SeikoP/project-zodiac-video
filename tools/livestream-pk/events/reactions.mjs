// Classifies chat lines into named groups and counts them. State is plain JSON in the caller:
// { users: [userId], byGroup: { group: [userId] } }. Groups are tried in object order, first match wins.

export function createReactions({ groups, onePerUser = true }, state = {}) {
  if (!Array.isArray(state.users)) state.users = [];
  if (!state.byGroup || typeof state.byGroup !== 'object') state.byGroup = {};
  const keys = Object.keys(groups);
  for (const k of keys) if (!Array.isArray(state.byGroup[k])) state.byGroup[k] = [];

  function react(userId, text, ctx) {
    if (onePerUser && state.users.includes(userId)) return null;
    for (const k of keys) {
      if (groups[k](text, ctx)) {
        state.byGroup[k].push(userId);
        if (!state.users.includes(userId)) state.users.push(userId);
        return k;
      }
    }
    return null;
  }
  function counts() {
    const out = {};
    for (const k of keys) out[k] = state.byGroup[k].length;
    return out;
  }
  function reset() {
    state.users = [];
    for (const k of keys) state.byGroup[k] = [];
  }
  return {
    react, counts, reset,
    has: (userId) => state.users.includes(userId),
    names: (group, k) => (state.byGroup[group] ?? []).slice(0, k),
  };
}
