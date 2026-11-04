// Lớp cá nhân: what each viewer did tonight, their quests, their role in the team, their MVP titles and the "hồ sơ" card.
//
// Everything lives inside the viewer (st.viewers[id]), plain JSON, so a restart keeps it:
//   v.titles                 ['MVP Boss ×3', ...]  oldest first, kept across nights
//   v.stats.night            the night the counters below belong to (they restart on a new night)
//   v.stats.c                this night's counters: { hits, pulls, blessings, ... } (see STAT_KEYS in quests.mjs)
//   v.stats.rw               this night's payouts, counted by the reward service (events/reward.mjs, via tally)
//   v.stats.done             quests finished tonight { questId: true }
//   v.stats.mvp              MVP counts per event id, kept across nights
// There is one personal level: the mascot level of "nâng cấp" (v.level, Lv1-5). The profile only reports it.

import { QUESTS, STAT_KEYS, drawQuests } from './quests.mjs';

export { STAT_KEYS };

export const PROFILE_DEFAULTS = Object.freeze({ profileCooldownSeconds: 30 });

export const ROLES_PERSONAL = Object.freeze(['fighter', 'guard', 'cheer']);
export const ROLE_LABEL = Object.freeze({ fighter: 'Chiến binh', guard: 'Hộ vệ', cheer: 'Cổ vũ' });
export const ROLE_BONUS = 0.03; // a tiny bit of extra starlight, nothing else changes
export const ROLE_MIN_TOTAL = 5;

const GROUPS = { fighter: ['hits', 'pulls'], guard: ['thaws', 'shields'], cheer: ['blessings', 'wishes', 'predictions'] };

// The role this night's play points to: the biggest group wins; a tie for first or fewer than 5 actions in all is no role.
export function roleOf(stats) {
  const scores = ROLES_PERSONAL.map(id => [id, GROUPS[id].reduce((sum, k) => sum + (Number(stats?.[k]) || 0), 0)]);
  const total = scores.reduce((sum, [, n]) => sum + n, 0);
  if (total < ROLE_MIN_TOTAL) return null;
  scores.sort((a, b) => b[1] - a[1]);
  return scores[0][1] === scores[1][1] ? null : scores[0][0];
}

// What an event's MVP title calls it (the caller may pass its own label, e.g. an act's name).
export const EVENT_LABELS = Object.freeze({ boss: 'Boss', tug: 'Kéo co', roast: 'Vòng quay', catch: 'Hứng sao' });

export function createProfile({ st, cfg = PROFILE_DEFAULTS, reward, now = Date.now, onEvent = () => {}, levelOf = v => v.level ?? 1, bank = QUESTS }) {
  const cooldown = () => (cfg.profileCooldownSeconds ?? PROFILE_DEFAULTS.profileCooldownSeconds) * 1000;

  // The viewer's stats for tonight (counters restart when the night number moved on).
  function bucket(v) {
    const s = (v.stats ??= {});
    if (s.night !== st.night.no || !s.c) {
      s.night = st.night.no;
      s.c = {};
      s.rw = {};
      s.done = {};
    }
    s.mvp ??= {};
    return s;
  }
  const questsFor = userId => drawQuests(userId, st.night.no, bank);

  // The object the reward service counts a viewer's payouts in (a throwaway for someone it does not know).
  const tally = userId => { const v = st.viewers[userId]; return v ? bucket(v).rw : {}; };

  // One thing a viewer did. Counts it for tonight and pays any quest it completes - once.
  function track(u, v, stat, n = 1) {
    if (!v?.team || !(n > 0) || !STAT_KEYS.includes(stat)) return;
    const s = bucket(v);
    const total = s.c[stat] = (s.c[stat] ?? 0) + n;
    for (const q of questsFor(u.userId)) {
      if (q.stat !== stat || s.done[q.id] || total < q.goal) continue;
      s.done[q.id] = true; // marked first: the payout can never run twice
      reward.grant(u, v, q.reward.kind, q.reward.n, 'quest');
      onEvent({ type: 'my-quest-done', userId: u.userId, nickname: v.nickname, avatar: v.avatar, team: v.team, id: q.id, label: q.label, reward: { ...q.reward } });
    }
  }

  const statsOf = userId => { const v = st.viewers[userId]; return v ? { ...bucket(v).c } : {}; };

  function progress(userId) {
    const v = st.viewers[userId];
    const s = v && bucket(v);
    return questsFor(userId).map(q => ({ id: q.id, label: q.label, goal: q.goal, got: Math.min(q.goal, s?.c[q.stat] ?? 0), done: Boolean(s?.done[q.id]), reward: { ...q.reward } }));
  }

  const roleOfViewer = v => (v ? roleOf(bucket(v).c) : null);
  const roleBonus = v => (roleOfViewer(v) ? ROLE_BONUS : 0);
  const roleLabel = v => ROLE_LABEL[roleOfViewer(v)] ?? null;

  function card(userId) {
    const v = st.viewers[userId];
    return { level: v ? levelOf(v) : 1, role: roleOfViewer(v), titles: [...(v?.titles ?? [])].reverse().slice(0, 3), streak: v?.streak ?? 0, quests: progress(userId) };
  }

  // The MVP of an event: "MVP <event> ×N" in the viewer's titles (one entry per event, moved to the newest place as N grows).
  function mvp(eventId, userId, label = EVENT_LABELS[eventId] ?? eventId) {
    const v = userId && st.viewers[userId];
    if (!v) return null;
    const s = bucket(v);
    const count = s.mvp[eventId] = (s.mvp[eventId] ?? 0) + 1;
    const title = `MVP ${label} ×${count}`;
    const own = `MVP ${label} ×`;
    v.titles = [...(v.titles ?? []).filter(t => !t.startsWith(own)), title];
    onEvent({ type: 'mvp', userId, nickname: v.nickname, avatar: v.avatar, team: v.team, event: eventId, label, title, count });
    return title;
  }

  // "hồ sơ": once per profileCooldownSeconds per person. True when the card was shown.
  function show(u, v) {
    if (!v || now() - (v.profileAt ?? -Infinity) < cooldown()) return false;
    v.profileAt = now();
    const c = card(u.userId);
    onEvent({ type: 'profile', userId: u.userId, nickname: v.nickname, avatar: v.avatar, team: v.team, level: c.level, role: c.role, roleLabel: ROLE_LABEL[c.role] ?? null, titles: c.titles, streak: c.streak,
      quests: c.quests.map(({ label, goal, got, done }) => ({ label, goal, got, done })) });
    return true;
  }

  return { track, progress, card, mvp, statsOf, tally, roleBonus, roleLabel, show, questsFor };
}
