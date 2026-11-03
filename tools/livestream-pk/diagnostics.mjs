// Tools for the first real live, when the only way to learn what TikTok actually sends is to look.
//   probe  — writes logs/tiktok-schema.json: for each event type, which fields arrived (names only, no
//            viewer text), so a renamed field is visible in seconds. Always on, tiny.
//   record — with recordEvents (or PK_RECORD=1) also keeps logs/events-<date>.jsonl: every parsed event the game
//            received (nicknames and comments included, so it stays on your machine). Replay it later with
//            `npm run replay -- logs/events-….jsonl` to reproduce a night without being live.
import fs from 'node:fs';
import path from 'node:path';

export function createDiagnostics({ dir, record = false, now = () => Date.now() }) {
  fs.mkdirSync(dir, { recursive: true });
  const schemaFile = path.join(dir, 'tiktok-schema.json');
  let schema = {};
  try { schema = JSON.parse(fs.readFileSync(schemaFile, 'utf8')); } catch { /* first run */ }
  const keys = o => (o && typeof o === 'object' ? Object.keys(o).sort() : []);

  function probe(type, data) {
    const isNew = !(type in schema);
    const seen = schema[type] ??= { fields: [], user: [] };
    const fields = keys(data), user = keys(data?.user);
    if (fields.some(f => !seen.fields.includes(f)) || user.some(f => !seen.user.includes(f)) || isNew) {
      seen.fields = [...new Set([...seen.fields, ...fields])].sort();
      seen.user = [...new Set([...seen.user, ...user])].sort();
      try { fs.writeFileSync(schemaFile, JSON.stringify(schema, null, 2)); } catch { /* diagnostics must never break the show */ }
    }
  }

  const eventsFile = path.join(dir, `events-${new Date(now()).toISOString().slice(0, 10)}.jsonl`);
  const out = record ? fs.createWriteStream(eventsFile, { flags: 'a' }) : null;
  const log = (type, e) => out?.write(`${JSON.stringify({ t: now(), type, ...e })}\n`);

  // Game calls are recorded first when recording is on.
  const wrap = game => ({
    chat: e => { log('chat', e); return game.chat(e); },
    member: e => { log('member', e); return game.member(e); },
    gift: e => { log('gift', e); return game.gift(e); },
    like: e => { log('like', e); return game.like(e); },
    social: e => { log('social', e); return game.social(e); },
  });
  const close = () => new Promise(resolve => (out ? out.end(resolve) : resolve()));
  return { probe, wrap, close, recording: Boolean(out), eventsFile };
}

// Feeds one recorded/hand-made event into a game (used by the replay API).
export function ingest(game, e) {
  const { type, t, replay, ...rest } = e ?? {};
  if (type === 'chat') return game.chat({ ...rest, comment: String(rest.comment ?? '') });
  if (type === 'member') return game.member(rest);
  if (type === 'gift') return game.gift(rest);
  if (type === 'like') return game.like(rest);
  if (type === 'social') return game.social(rest);
  throw new Error(`unknown event type: ${type}`);
}
