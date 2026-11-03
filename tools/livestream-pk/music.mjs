// Finds the background tracks. Two moods:
//   <dir>/livestream/calm/*   and   <dir>/livestream/upbeat/*   — the folder decides (see scripts/fetch-audio.mjs)
//   <dir>/*.mp3               — loose files: names containing "fun" are upbeat, everything else calm
// Files that are sound-effect/comedy clips rather than music ("blooper", "comedy", "sfx") are skipped.
// Override with musicDir / musicExclude / musicUpbeat (regular expressions) in config.json.
import fs from 'node:fs';
import path from 'node:path';

const AUDIO = /\.(mp3|ogg|wav|m4a)$/i;
const prettify = file => path.basename(file).replace(/\.\w+$/, '').replace(/^mixkit-/, '').replace(/[-_]\d{3,}$/, '').replace(/[-_]+/g, ' ').trim();

export function listMusic({ dir, exclude = 'blooper|comedy|sfx', upbeat = 'fun' } = {}) {
  const out = { calm: [], upbeat: [], skipped: [] };
  if (!dir || !fs.existsSync(dir)) return out;
  const skip = new RegExp(exclude, 'i'), lively = new RegExp(upbeat, 'i');
  const add = (rel, mood) => (skip.test(rel) ? out.skipped.push(rel) : out[mood].push({ file: rel.split(path.sep).join('/'), title: prettify(rel) }));
  for (const file of fs.readdirSync(dir).filter(f => AUDIO.test(f)).sort()) add(file, lively.test(file) ? 'upbeat' : 'calm');
  for (const mood of ['calm', 'upbeat']) {
    const sub = path.join(dir, 'livestream', mood);
    if (fs.existsSync(sub)) for (const file of fs.readdirSync(sub).filter(f => AUDIO.test(f)).sort()) add(path.join('livestream', mood, file), mood);
  }
  return out;
}
