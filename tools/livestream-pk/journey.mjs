// Hành trình đêm: the night is one story in five chapters instead of minigames side by side. Each chapter is a goal
// the whole room reaches by playing (gather, light constellations, call the full moon, win fights, finish the wheel);
// finishing one pays everyone on stage and opens the next, the last one pays a moon shard. The centre of the screen
// always shows the chapter in progress, so a newcomer sees at once what the room is doing.
// Đội nguyên tố: the four elements (Hỏa · Thổ · Phong · Thủy) race on the starlight their fans shed tonight; a new
// leader is announced (a reversal), at most once per elementLeadCooldownSeconds.

export const CHAPTERS = Object.freeze([
  { id: 'gather', icon: '✨', label: 'Tụ hội', goal: 'người chọn cung', need: 5, on: e => e.type === 'join' },
  { id: 'lit', icon: '🌟', label: 'Thắp sáng', goal: 'chòm sao bừng sáng', need: 3, on: e => e.type === 'lit' },
  { id: 'moon', icon: '🌕', label: 'Gọi trăng rằm', goal: 'lần trăng tròn', need: 1, on: e => e.type === 'moon-full' },
  { id: 'win', icon: '⚔️', label: 'Chiến thắng', goal: 'chiến công (hạ boss, kéo co, giải cung bí ẩn)', need: 2, on: e => e.type === 'boss-defeated' || (e.type === 'tug-end' && e.winner) || (e.type === 'mystery-win' && e.rank === 1) },
  { id: 'wheel', icon: '👑', label: 'Đại hội sao', goal: 'vòng hoàng đạo trọn vẹn', need: 1, on: e => e.type === 'wheel-complete' },
]);
export const ELEMENTS = Object.freeze(['fire', 'earth', 'air', 'water']);
export const JOURNEY_DEFAULTS = Object.freeze({ journeyDust: 10, elementLeadCooldownSeconds: 90 });

// stageIds(): viewer ids on stage; dust(u, v, n) / moon(u, v): rewards; elementOf(sign)
export function createJourney({ st, cfg, now, onEvent, stageIds, dust, moon, elementOf }) {
  // both reset with the night
  const J = () => {
    if (st.journey?.night !== st.night.no) st.journey = { night: st.night.no, i: 0, got: 0, done: false };
    if (st.elements?.night !== st.night.no) st.elements = { night: st.night.no, light: Object.fromEntries(ELEMENTS.map(k => [k, 0])), lead: null, leadAt: 0 };
    return st.journey;
  };
  const onStage = () => [...stageIds()].map(id => [id, st.viewers[id]]).filter(([, v]) => v?.sign);

  function note(e) {
    const j = J();
    if (e.type === 'light' && e.sign && e.amount > 0) lightUp(elementOf(e.sign), e.amount);
    const c = CHAPTERS[j.i];
    if (j.done || !c?.on(e)) return;
    j.got = Math.min(c.need, j.got + 1);
    if (j.got < c.need) return;
    const people = onStage();
    for (const [id, v] of people) dust({ userId: id }, v, cfg.journeyDust);
    const next = CHAPTERS[j.i + 1] ?? null;
    j.i++;
    j.got = 0;
    j.done = !next;
    onEvent({ type: 'chapter', no: j.i, of: CHAPTERS.length, id: c.id, label: c.label, icon: c.icon, people: people.length, dust: cfg.journeyDust, next: next && { id: next.id, label: next.label, icon: next.icon, goal: next.goal, need: next.need } });
    if (!next) {
      for (const [id, v] of people) moon({ userId: id }, v);
      onEvent({ type: 'journey-done', people: people.length });
    }
  }

  function lightUp(el, amount) {
    const E = st.elements;
    E.light[el] += amount;
    const lead = ELEMENTS.reduce((a, b) => (E.light[b] > E.light[a] ? b : a));
    if (lead === E.lead || E.light[lead] <= 0) return;
    const prev = E.lead, t = now();
    E.lead = lead;
    if (!prev || t - E.leadAt < cfg.elementLeadCooldownSeconds * 1000) { if (!prev) E.leadAt = t; return; }
    E.leadAt = t;
    onEvent({ type: 'element-lead', element: lead, prev, light: Math.round(E.light[lead]), gap: Math.round(E.light[lead] - E.light[prev]) });
  }

  function view() {
    const j = J(), c = CHAPTERS[Math.min(j.i, CHAPTERS.length - 1)];
    return { no: Math.min(j.i + 1, CHAPTERS.length), of: CHAPTERS.length, id: c.id, label: c.label, icon: c.icon, goal: c.goal, got: j.done ? c.need : j.got, need: c.need, done: j.done,
      elements: { light: Object.fromEntries(ELEMENTS.map(k => [k, Math.round(st.elements.light[k])])), lead: st.elements.lead } };
  }
  return { note, view };
}
