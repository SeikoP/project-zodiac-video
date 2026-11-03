// Builds the 12 sign mascots (one SVG per sign × mood) from the video pipeline's
// character assembler, so the livestream cast matches the channel's videos.
//   node build-mascots.mjs            → public/mascots/<sign>-<mood>.svg
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileCharacterSvg } from '../../plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4/characters/compile-character-assembly.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, 'public', 'mascots');

// One look per sign; shirt colour follows the element (fire coral, earth ochre, air teal, water slate).
export const CAST = {
  aries: ['standard_compact', 'spiky-overthink', 'coral'],
  taurus: ['round_soft', 'short-curl', 'ochre'],
  gemini: ['petite_compact', 'high-tied-ponytail', 'teal'],
  cancer: ['round_soft', 'long-side-part', 'slate'],
  leo: ['stocky_short', 'soft-mohawk', 'coral'],
  virgo: ['lean_tall', 'low-ponytail', 'ochre'],
  libra: ['standard_compact', 'curtain-bang', 'teal'],
  scorpio: ['lean_tall', 'curtain-bang', 'slate'],
  sagittarius: ['lanky_slouch', 'antenna-short', 'coral'],
  capricorn: ['stocky_short', 'blocky-cut', 'ochre'],
  aquarius: ['lanky_slouch', 'asym-bang', 'teal'],
  pisces: ['petite_compact', 'long-side-part', 'slate'],
};

// Mood → pose/expression. The overlay picks a mood from rank and recent events.
export const MOODS = {
  idle: ['neutral', 'neutral'],
  hype: ['point-choice', 'smug'],
  win: ['explain', 'relieved'],
  panic: ['recoil', 'panic'],
  sad: ['facepalm', 'exasperated'],
};

export function mascotSvg(sign, mood) {
  const [body_profile, hair_id, shirt_color_id] = CAST[sign];
  const [pose_id, expression_id] = MOODS[mood];
  const identity = { entity_id: `pk-${sign}`, body_profile, hair_id, outfit_id: 'zodiac-glyph-shirt', zodiac_sign_id: sign, shirt_color_id };
  return compileCharacterSvg(identity, { pose_id, expression_id }).svg;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await mkdir(OUT, { recursive: true });
  for (const sign of Object.keys(CAST)) for (const mood of Object.keys(MOODS)) await writeFile(path.join(OUT, `${sign}-${mood}.svg`), mascotSvg(sign, mood));
  console.log(`wrote ${Object.keys(CAST).length * Object.keys(MOODS).length} mascots to ${OUT}`);
}
