// Comments -> commands. A command is a short comment starting with a verb; anything else is just chat.
import { cropByName } from './crops.mjs';

const norm = s => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replaceAll('đ', 'd').replace(/\s+/g, ' ').trim();

const VERBS = [ // longer phrases first: "bắt trộm" and "bắt sâu" must win over "trộm"
  [/^bat\s+trom\b/, 'catch'], [/^bat\s+sau\b/, 'pest'], [/^tha\s+cho\b/, 'dog'], [/^trong\b/, 'plant'], [/^tuoi\b/, 'water'],
  [/^hai\b/, 'harvest'], [/^trom\b/, 'steal'], [/^vuon\b/, 'card'],
];

export function parseCommand(text) {
  const raw = String(text ?? '').trim();
  if (!raw || raw.length > 60) return null;
  const t = norm(raw);
  const mention = t.match(/@\s*(.+)$/)?.[1].trim() || null;
  const body = t.replace(/@.*$/, '').trim();
  for (const [re, cmd] of VERBS) {
    if (!re.test(body)) continue;
    return { cmd, arg: cmd === 'plant' ? cropByName(body.replace(re, '').trim()) : null, mention };
  }
  return null;
}

export function resolveMention(state, mention, exceptUserId) {
  if (!mention) return null;
  const m = norm(mention).trim();
  const hits = Object.values(state.users).filter(u => u.seat && norm(u.nickname).startsWith(m));
  if (hits.length !== 1 || hits[0].userId === exceptUserId) return null;
  return hits[0];
}

export function createLimiter(now) {
  const last = new Map();
  return { allow(userId, key, ms) {
    const k = `${userId}|${key}`, t = now();
    if (t - (last.get(k) ?? -Infinity) < ms) return false;
    last.set(k, t);
    return true;
  } };
}
