// The event lane: ONE thing is announced on screen at a time.
//
//   level 0  tick        small card in the centre of the wheel (someone joined, a small gift…)
//   level 1  card        one announcement strip (a constellation lit, a title, a follow, a firework gift…)
//   level 2  modal       a reading, quiz or poll — lives as long as the game says (`holdWhile`)
//   level 3  celebrate   the big moments (wheel complete, full moon, meteor shower…)
//
// A higher level interrupts a lower one. An interrupted announcement is dropped (it would be stale) — except
// a modal, which is suspended and comes back when the big moment is over. Equal or lower levels wait in a
// short queue (newest wins for the same `key`, stale items are skipped).
//
// An event is { key, level, ms | holdWhile, minShow?, show(ev), hide(reason), done?(reason), ttl?, update?() }.
// minShow: how long it must stay up before something higher may interrupt it (so a quiz is readable).
// breath: after a level-3 celebration ends, no new one starts for this long, so cards and modals get their turn.
// show/hide always come in pairs (a suspended modal is hidden, then shown again); done() is called once when
// the event is over for good (finished, dropped or cleared), never when it is merely suspended.
const DEFAULT_TTL = { 0: 2500, 1: 6000, 2: 60000, 3: 20000 };
const MAX_BIG_WAITING = 2;

export function createLane({ now = () => Date.now(), maxQueue = 4, breath = 0 } = {}) {
  let cur = null, bigEndedAt = -Infinity;
  const queue = [], suspended = [];
  const inBreath = t => breath > 0 && t - bigEndedAt < breath;

  function start(ev) {
    cur = ev;
    ev.startedAt = now();
    ev.endsAt = ev.holdWhile ? Infinity : ev.startedAt + (ev.ms ?? 2500);
    ev.show?.(ev);
  }
  function stop(reason) {
    const c = cur;
    cur = null;
    if (c?.level === 3) bigEndedAt = now();
    c?.hide?.(reason);
    return c;
  }
  function preempt(ev) {
    const interrupted = stop('preempt');
    if (interrupted.holdWhile) suspended.push(interrupted); // a modal comes back later
    else interrupted.done?.('dropped');
    start(ev);
  }

  function enqueue(ev) {
    const same = queue.findIndex(q => q.key === ev.key && q.level === ev.level);
    if (same >= 0) queue.splice(same, 1); // the newest announcement of a kind replaces the waiting one
    queue.push(ev);
    const bigs = queue.filter(q => q.level === 3);
    if (bigs.length > MAX_BIG_WAITING) queue.splice(queue.indexOf(bigs[0]), 1); // celebrations do not pile up
    while (queue.length > maxQueue) {
      let drop = 0;
      for (let i = 1; i < queue.length; i++) if (queue[i].level < queue[drop].level) drop = i; // lowest level, oldest first
      queue.splice(drop, 1);
    }
  }

  function submit(ev) {
    const t = now();
    ev.queuedAt = t;
    if (!cur) return void (ev.level === 3 && inBreath(t) ? enqueue(ev) : start(ev));
    if (ev.level > cur.level && t - cur.startedAt >= (cur.minShow ?? 0) && !(ev.level === 3 && inBreath(t))) return void preempt(ev);
    enqueue(ev);
  }

  // The best waiting event at or above `minLevel`: highest level first, FIFO within a level.
  function best(minLevel, t) {
    let b = -1;
    for (let i = 0; i < queue.length; i++) {
      const q = queue[i];
      if (q.level < minLevel || (q.level === 3 && inBreath(t))) continue;
      if (b < 0 || q.level > queue[b].level) b = i;
    }
    return b;
  }

  // Call about every 100ms.
  function tick() {
    const t = now();
    for (let i = queue.length - 1; i >= 0; i--) if (t - queue[i].queuedAt > (queue[i].ttl ?? DEFAULT_TTL[queue[i].level])) queue.splice(i, 1);
    if (cur) {
      const over = cur.holdWhile ? !cur.holdWhile() : t >= cur.endsAt;
      if (!over) {
        const i = best(cur.level + 1, t);
        if (i >= 0 && t - cur.startedAt >= (cur.minShow ?? 0)) return void preempt(queue.splice(i, 1)[0]);
        return void cur.update?.(cur);
      }
      stop('ended')?.done?.('ended');
    }
    while (suspended.length) {
      const s = suspended.pop();
      if (s.holdWhile()) return void start(s);
      s.done?.('ended'); // it finished while it was out of sight (already hidden)
    }
    const i = best(0, t);
    if (i >= 0) start(queue.splice(i, 1)[0]);
  }

  return {
    submit,
    tick,
    current: () => cur,
    idle: () => !cur,
    pending: () => queue.length + suspended.length,
    clear() { for (const s of suspended) s.done?.('clear'); queue.length = 0; suspended.length = 0; stop('clear')?.done?.('clear'); },
  };
}
