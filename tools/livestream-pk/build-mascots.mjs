// Builds the colour-team mascots (one SVG per team x mood) from the video pipeline's character assembler, so the
// livestream cast matches the channel's videos. Plain shirt (no zodiac glyph), recoloured to the team colour.
//   node build-mascots.mjs            -> public/mascots/<team>-<mood>.svg
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileCharacterSvg } from '../../plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4/characters/compile-character-assembly.mjs';
import { TEAMS } from './public/teams.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, 'public', 'mascots');

// One look per team (body, hair, nearest catalogue shirt). The catalogue only has four fixed shirt colours, so the
// shirt hex it prints is swapped for the team colour afterwards.
export const CAST = {
  red: ['stocky_short', 'soft-mohawk', 'coral', '#E97A66'],
  yellow: ['petite_compact', 'high-tied-ponytail', 'ochre', '#F2C45C'],
  green: ['lean_tall', 'low-ponytail', 'teal', '#8EC0B9'],
  blue: ['round_soft', 'long-side-part', 'slate', '#435064'],
};

// Mood -> pose/expression. The overlay picks a mood from rank and recent events.
export const MOODS = {
  idle: ['neutral', 'neutral'],
  hype: ['point-choice', 'smug'],
  win: ['explain', 'relieved'],
  panic: ['recoil', 'panic'],
  sad: ['facepalm', 'exasperated'],
};

export function mascotSvg(team, mood) {
  const [body_profile, hair_id, shirt_color_id, printed] = CAST[team];
  const [pose_id, expression_id] = MOODS[mood];
  const identity = { entity_id: `pk-${team}`, body_profile, hair_id, outfit_id: 'plain-shirt', shirt_color_id };
  const color = TEAMS.find(t => t.id === team).color;
  return compileCharacterSvg(identity, { pose_id, expression_id }).svg.replaceAll(printed, color).replaceAll(printed.toLowerCase(), color);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await mkdir(OUT, { recursive: true });
  for (const team of Object.keys(CAST)) for (const mood of Object.keys(MOODS)) await writeFile(path.join(OUT, `${team}-${mood}.svg`), mascotSvg(team, mood));
  console.log(`wrote ${Object.keys(CAST).length * Object.keys(MOODS).length} mascots to ${OUT}`);
}
