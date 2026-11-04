// The four colour teams and the chat words that pick one. A name only counts as the WHOLE comment (after an optional
// "phe/team/chon" prefix), so "do an gi" or "cho do vao day" never move anybody. A bare digit picks a team (parseTeam,
// for people with no team yet) but never switches one: switching needs "doi ..." or the exact colour name.

import { TEAMS, TEAM_IDS } from '../public/teams.js';

export { TEAMS, TEAM_IDS };

export const normText = s => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replaceAll('đ', 'd');

const clean = s => normText(s).replace(/[^a-z0-9]+/g, ' ').trim();
const NAMES = { do: 'red', vang: 'yellow', xanh: 'green', lam: 'blue', 'xanh la': 'green', 'xanh duong': 'blue' };
const byName = s => NAMES[s] ?? null;
const byDigit = s => (/^[1-4]$/.test(s) ? TEAM_IDS[Number(s) - 1] : null);

export function parseTeam(comment) {
  const s = clean(comment).replace(/^(?:(?:phe|team|chon)\s+)+/, '');
  return byName(s) ?? byDigit(s);
}

export function parseSwitchTeam(comment) {
  const s = clean(comment);
  const m = /^(?:doi|chuyen)(?: sang| qua)?\s+(?:(?:phe|team)\s+)?(.+)$/.exec(s);
  if (m) return byName(m[1]) ?? byDigit(m[1]);
  return byName(s.replace(/^(?:(?:phe|team)\s+)+/, ''));
}
