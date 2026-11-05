import { addXp } from './progress.mjs';

const POINTS = Object.freeze({ join: 1, plant: 1, water: 1, help: 2, pest: 2, harvest: 3, protect: 2, catch: 2 });

export const TITLE_LABELS = Object.freeze({
  bossSlayer: 'Khắc tinh Sâu Chúa', firstHarvest: 'Người gieo mây', helpful: 'Bạn tốt', pestKeeper: 'Người giữ vườn',
  podium1: 'Vương miện mây', podium2: 'Gió bạc', podium3: 'Nắng chăm chỉ',
  harvest100:'Mùa vụ trăm hoa',helpful50:'Bàn tay xanh',pestKeeper50:'Người gác vườn',harvest10:'Tay hái chăm chỉ',harvest50:'Bậc thầy mùa vụ',helpful20:'Bạn của cả vườn',pestKeeper20:'Vệ sĩ mầm xanh',
});

const makeSession = (no, now, previous = null) => ({ no, phase: 'active', startedAt: now(), previous });
const careerOf = user => {
  const career = user.career ??= {};
  for (const key of ['points', 'helps', 'pests', 'podiums', 'wins', 'harvests']) career[key] ??= 0;
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
  if (!harvest&&!user.titles?.firstHarvest&&!(user.career?.harvests>0)) return { label: 'Thu hoạch đầu tiên', progress: 0, target: 1 };
  if (helps < 5) return { label: 'Trợ giúp để nhận Bạn tốt', progress: helps, target: 5 };
  if (pests < 5) return { label: 'Dọn sâu để nhận Người giữ vườn', progress: pests, target: 5 };
  for(const [label,progress,target] of [['Tay hái chăm chỉ',user.career?.harvests??0,10],['Bạn của cả vườn',helps,20],['Vệ sĩ mầm xanh',pests,20],['Bậc thầy mùa vụ',user.career?.harvests??0,50],['Mùa vụ trăm hoa',user.career?.harvests??0,100],['Bàn tay xanh',helps,50],['Người gác vườn',pests,50]])if(progress<target)return {label,progress,target};
  const points = user.competition?.points ?? 0, target = Math.max(25, (Math.floor(points / 25) + 1) * 25);
  return { label: `Chạm ${target} điểm phiên`, progress: points, target };
};

export function createCompetition({ state, now = Date.now, sessionMs = 600000, awardsMs = 8000, onFinish = () => {}, onStart = () => {} }) {
  let revision = 0;
  function ensureSession() {
    if(state.session&&state.session.phase!=='awards'&&state.session.pausedAt==null&&now()>=state.session.startedAt+sessionMs){
      if(standings().length)finish();
      else {state.session.startedAt=now();revision++;}
    }
    return state.session ??= makeSession(1, now);
  }
  function tick(){
    const s=state.session;
    if(s?.phase==='awards'){
      if(now()<s.awardsUntil)return;
      state.session=makeSession(s.no+1,now,s.completed);revision++;
      onStart(s.completed,s.pendingGifts??[]);
    } else if(s&&s.pausedAt==null&&now()>=s.startedAt+sessionMs)ensureSession();
  }

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
      .map((u, i) => ({ rank: i + 1, userId: u.userId, nickname: u.nickname,avatar:u.avatar??'',level:u.level, points: u.competition.points, harvests: u.competition.harvests, title: Object.keys(u.titles ?? {}).at(-1) ? TITLE_LABELS[Object.keys(u.titles).at(-1)] : null, milestone: milestoneOf(u) }));
  }

  function score(user, action) {
    const points = POINTS[action];
    if (!points) return null;
    const session = ensureSession();
    if(session.phase==='awards')return null;
    const { career, current } = currentUser(user, session);
    current.points += points;
    current.lastAt = now();
    career.points += points;
    if (action === 'harvest') {current.harvests++;career.harvests++;}
    if (action === 'help') career.helps++;
    if (action === 'pest') career.pests++;
    revision++;
    const titles = [];
    if ((user.stats?.harvest ?? 0) > 0 && titleOf(user, 'firstHarvest')) titles.push(TITLE_LABELS.firstHarvest);
    if (career.helps >= 5 && titleOf(user, 'helpful')) titles.push(TITLE_LABELS.helpful);
    if (career.pests >= 5 && titleOf(user, 'pestKeeper')) titles.push(TITLE_LABELS.pestKeeper);
    for(const [id,total,target] of [['harvest10',career.harvests,10],['harvest50',career.harvests,50],['harvest100',career.harvests,100],['helpful50',career.helps,50],['pestKeeper50',career.pests,50],['helpful20',career.helps,20],['pestKeeper20',career.pests,20]])if(total>=target&&titleOf(user,id))titles.push(TITLE_LABELS[id]);
    return { points, total: current.points, titles };
  }

  function profile(user) {
    const current = state.session && user.competition?.no === state.session.no ? user.competition : null;
    const rank = standings().find(x => x.userId === user.userId)?.rank ?? null;
    return { rank, points: current?.points ?? 0, lifetimePoints: user.career?.points ?? 0, milestone: milestoneOf(user), titles: Object.entries(user.titles ?? {}).map(([id, count]) => ({ id, label: TITLE_LABELS[id] ?? id, count })).reverse() };
  }

  function status() {
    return { revision, session: state.session && { no: state.session.no, startedAt: state.session.startedAt, endsAt:state.session.startedAt+sessionMs, pausedAt:state.session.pausedAt??null, phase:state.session.phase??'active', awardsUntil:state.session.awardsUntil??null, completed:state.session.completed??null, previous: state.session.previous ?? null }, standings: standings() };
  }

  function finish() {
    const session = state.session;
    if (!session) return { no: null, podium: [], next: null };
    if(session.pausedAt!=null)return {ok:false,reason:'boss-active'};
    if(session.phase==='awards')return session.completed;
    const podium = standings().slice(0, 3).map((entry, i) => {
      const user = state.users[entry.userId], place = i + 1, id = `podium${place}`;
      titleOf(user, id, true);
      const career = careerOf(user);
      career.podiums++;
      if (place === 1) career.wins++;
      const rewardXp=[15,10,5][i];addXp(user,rewardXp);
      return { ...entry, title: TITLE_LABELS[id], rewardXp, level:user.level };
    });
    const completed = { no: session.no, startedAt: session.startedAt, endedAt: now(), podium,standings:standings().slice(0,5) };
    Object.assign(session,{phase:'awards',awardsUntil:now()+awardsMs,completed,pendingGifts:[]});
    revision++;
    onFinish(completed);
    return completed;
  }

  return { score, standings, profile, status, finish, tick,
    pause(){if(state.session&&state.session.pausedAt==null){state.session.pausedAt=now();revision++;}},
    resume(){const s=state.session;if(s?.pausedAt==null)return 0;const elapsed=Math.max(0,now()-s.pausedAt);s.startedAt+=elapsed;delete s.pausedAt;revision++;return elapsed;},
    revision: () => revision };
}
