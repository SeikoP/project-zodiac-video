const POINTS = Object.freeze({ join: 1, plant: 1, water: 1, help: 2, pest: 2, harvest: 3, protect: 2, catch: 2 });

export const TITLE_LABELS = Object.freeze({
  firstHarvest: 'Người gieo mây', helpful: 'Bạn tốt', pestKeeper: 'Người giữ vườn',
  podium1: 'Vương miện mây', podium2: 'Gió bạc', podium3: 'Nắng chăm chỉ',
});

const makeSession = (no, now, previous = null) => ({ no, startedAt: now(), previous });
const careerOf = user => {
  const career = user.career ??= {};
  for (const key of ['points', 'helps', 'pests', 'podiums', 'wins']) career[key] ??= 0;
  return career;
};
const titleOf = (user, id, repeat = false) => {
  user.titles ??= {};
  if (user.titles[id] && !repeat) return false;
  user.titles[id] = (user.titles[id] ?? 0) + 1;
  return true;
};
const milestoneOf = user => {
  const harvest = user.stats?.harvest ?? 0, helps = user.career?.helps ?? 0, pests = user.career?.pests ?? 0;
  if (!harvest) return { label: 'Thu hoạch đầu tiên', progress: 0, target: 1 };
  if (helps < 5) return { label: 'Trợ giúp để nhận Bạn tốt', progress: helps, target: 5 };
  if (pests < 5) return { label: 'Dọn sâu để nhận Người giữ vườn', progress: pests, target: 5 };
  const points = user.competition?.points ?? 0, target = Math.max(25, (Math.floor(points / 25) + 1) * 25);
  return { label: `Chạm ${target} điểm phiên`, progress: points, target };
};

export function createCompetition({ state, now = Date.now }) {
  let revision = 0;
  function ensureSession() { return state.session ??= makeSession(1, now); }

  function currentUser(user, session = state.session) {
    const career = careerOf(user);
    if (user.competition?.no !== session.no) user.competition = { no: session.no, points: 0, harvests: 0, lastAt: 0 };
    return { career, current: user.competition };
  }

  function standings() {
    if (!state.session) return [];
    return Object.values(state.users)
      .filter(u => u.competition?.no === state.session.no && u.competition.points > 0)
      .sort((a, b) => b.competition.points - a.competition.points || b.competition.harvests - a.competition.harvests || a.competition.lastAt - b.competition.lastAt)
      .map((u, i) => ({ rank: i + 1, userId: u.userId, nickname: u.nickname, points: u.competition.points, harvests: u.competition.harvests, title: Object.keys(u.titles ?? {}).at(-1) ? TITLE_LABELS[Object.keys(u.titles).at(-1)] : null, milestone: milestoneOf(u) }));
  }

  function score(user, action) {
    const points = POINTS[action];
    if (!points) return null;
    const session = ensureSession(), { career, current } = currentUser(user, session);
    current.points += points;
    current.lastAt = now();
    career.points += points;
    if (action === 'harvest') current.harvests++;
    if (action === 'help') career.helps++;
    if (action === 'pest') career.pests++;
    revision++;
    const titles = [];
    if ((user.stats?.harvest ?? 0) > 0 && titleOf(user, 'firstHarvest')) titles.push(TITLE_LABELS.firstHarvest);
    if (career.helps >= 5 && titleOf(user, 'helpful')) titles.push(TITLE_LABELS.helpful);
    if (career.pests >= 5 && titleOf(user, 'pestKeeper')) titles.push(TITLE_LABELS.pestKeeper);
    return { points, total: current.points, titles };
  }

  function profile(user) {
    const current = state.session && user.competition?.no === state.session.no ? user.competition : null;
    const rank = standings().find(x => x.userId === user.userId)?.rank ?? null;
    return { rank, points: current?.points ?? 0, lifetimePoints: user.career?.points ?? 0, milestone: milestoneOf(user), titles: Object.entries(user.titles ?? {}).map(([id, count]) => ({ id, label: TITLE_LABELS[id] ?? id, count })).reverse() };
  }

  function status() {
    return { revision, session: state.session && { no: state.session.no, startedAt: state.session.startedAt, previous: state.session.previous ?? null }, standings: standings() };
  }

  function finish() {
    const session = state.session;
    if (!session) return { no: null, podium: [], next: null };
    const podium = standings().slice(0, 3).map((entry, i) => {
      const user = state.users[entry.userId], place = i + 1, id = `podium${place}`;
      titleOf(user, id, true);
      const career = careerOf(user);
      career.podiums++;
      if (place === 1) career.wins++;
      return { ...entry, title: TITLE_LABELS[id] };
    });
    const completed = { no: session.no, startedAt: session.startedAt, endedAt: now(), podium };
    state.session = makeSession(session.no + 1, now, completed);
    revision++;
    return completed;
  }

  return { score, standings, profile, status, finish, revision: () => revision };
}
