// "First N to type the right thing" round. State is plain JSON in the caller:
// { open, openedAt, ctx, winners: [userId] }. `match(text, ctx)` decides what counts as right.

export function createKeywordRound({ now, match, winners: maxWinners, windowMs }, state = {}) {
  if (!Array.isArray(state.winners)) state.winners = [];
  state.open = !!state.open;

  function open(ctx) {
    state.open = true;
    state.openedAt = now();
    state.ctx = ctx;
    state.winners = [];
  }
  function close() {
    state.open = false;
    return state.winners.slice();
  }
  function submit(userId, text) {
    if (!state.open) return 'late';
    if (now() - state.openedAt >= windowMs) { state.open = false; return 'late'; }
    if (state.winners.includes(userId)) return 'dup';
    if (!match(text, state.ctx)) return 'miss';
    if (state.winners.length >= maxWinners) { state.open = false; return 'late'; }
    state.winners.push(userId);
    if (state.winners.length >= maxWinners) state.open = false;
    return 'win';
  }
  return {
    open, submit, close,
    isOpen: () => state.open,
    winnersList: () => state.winners.slice(),
    ctx: () => state.ctx,
  };
}
