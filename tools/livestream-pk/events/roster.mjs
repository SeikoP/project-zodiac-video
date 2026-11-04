// Who is on which team. State stays in the caller: `viewers` is st.viewers ({userId: {team}}), `stage` is a
// Map<userId,true> of viewers currently on stage. Counts are of the stage only.

import { TEAM_IDS } from './teams.mjs';

// A team is never "crowded" below this many people, so two friends can share a colour in a fresh room.
export const MIN_TEAM_SIZE = 3;

export function createRoster({ viewers, stage }) {
  const teamOf = userId => viewers[userId]?.team ?? null;
  const present = team => [...stage.keys()].filter(id => viewers[id] && (!team || viewers[id].team === team)).map(id => [id, viewers[id]]);
  function counts() {
    const c = Object.fromEntries(TEAM_IDS.map(t => [t, 0]));
    for (const [, v] of present()) if (v.team in c) c[v.team]++;
    return c;
  }
  // Fewest on stage, then least light, then TEAMS order.
  function leastTeam(light = {}) {
    const c = counts();
    return TEAM_IDS.reduce((best, t) => (c[t] < c[best] || (c[t] === c[best] && (light[t] ?? 0) < (light[best] ?? 0)) ? t : best));
  }
  // A newcomer gets the team they asked for unless it already has more than twice the smallest team.
  function place(wanted, light) {
    const c = counts();
    const valid = TEAM_IDS.includes(wanted);
    if (valid && !(c[wanted] >= MIN_TEAM_SIZE && c[wanted] > 2 * Math.min(...Object.values(c)))) return { team: wanted, redirected: false };
    const team = leastTeam(light);
    return { team, redirected: valid && team !== wanted };
  }
  return { teamOf, present, counts, leastTeam, place };
}
