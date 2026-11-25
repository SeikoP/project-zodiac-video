#!/usr/bin/env node
// Runs plugin Phase-2 validators against a workspace and prints ONE JSON value on stdout.
// Usage: node validators_bridge.mjs <workspace> <name[,name...]>
// Names: progressive-preflight | scene-experience | authoring-completeness | story-visual-presence
// Read-only: never writes into the workspace. Missing prerequisites are reported, never papered over.
import {execFile} from 'node:child_process';
import {access, readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {promisify} from 'node:util';

const run = promisify(execFile);
const PLUGIN = fileURLToPath(new URL('../../../plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/', import.meta.url));
const FEATURE = 'features/visual-composition/';
const CLI = {
  'progressive-preflight': {script: FEATURE + 'validate-phase02-progressive-preflight.mjs', needs: ['.authoring/visual-intent.json', 'production.json', 'design.md']},
  'authoring-completeness': {script: FEATURE + 'validate-phase02-authoring-completeness.mjs', needs: ['.authoring/visual-intent.json', 'production.json']},
  'story-visual-presence': {script: FEATURE + 'validate-story-visual-presence.mjs', needs: ['.authoring/visual-intent.json', 'narration.txt']},
};
const exists = file => access(file).then(() => true, () => false);
// Remotion-era Phase-2 files. A Studio episode (marked by its import receipt) compiles from Visual Intent and never
// writes them, so a validator that needs only these is not applicable there; any other missing input still BLOCKS.
const NOT_WRITTEN_BY_STUDIO = new Set(['production.json', 'design.md']);

async function sceneExperience(root) {
  const intent = JSON.parse(await readFile(path.join(root, '.authoring/visual-intent.json'), 'utf8'));
  const {reviewSceneExperience} = await import(pathToFileURL(path.join(PLUGIN, FEATURE, 'validate-scene-experience.mjs')).href);
  const review = reviewSceneExperience(intent);
  const issues = [];
  for (const scene of review.scenes) for (const issue of scene.issues) issues.push({...issue, scene_id: scene.scene_id});
  for (const issue of review.scene_graph_issues ?? []) issues.push({...issue});
  return {name: 'scene-experience', status: review.decision === 'PASS' ? 'PASS' : 'REVIEW', issues};
}

async function cli(root, name) {
  const spec = CLI[name];
  const missing = [];
  for (const rel of spec.needs) if (!(await exists(path.join(root, rel)))) missing.push(rel);
  if (missing.length && missing.every(rel => NOT_WRITTEN_BY_STUDIO.has(rel)) && await exists(path.join(root, 'studio-import-receipt.json'))) {
    return {name, status: 'SKIPPED', issues: []};
  }
  if (missing.length) {
    return {name, status: 'BLOCKED', issues: [{code: 'VALIDATOR_PREREQUISITE_MISSING', missing}]};
  }
  try {
    const {stdout} = await run(process.execPath, [path.join(PLUGIN, spec.script), root], {maxBuffer: 8 * 1024 * 1024, timeout: 110000});
    return normalize(name, JSON.parse(stdout));
  } catch (error) {
    // The plugin CLIs exit non-zero on BLOCKED/REVIEW but still print their JSON result.
    try { return normalize(name, JSON.parse(error.stdout)); } catch { /* fall through */ }
    return {name, status: 'BLOCKED', issues: [{code: 'VALIDATOR_FAILED', message: String(error.stderr || error.message).slice(0, 400)}]};
  }
}

function normalize(name, result) {
  const raw = result.status ?? result.decision;
  const status = raw === 'PASS' ? 'PASS' : raw === 'REVIEW' ? 'REVIEW' : 'BLOCKED';
  return {name, status, issues: Array.isArray(result.issues) ? result.issues : []};
}

async function main() {
  const [workspace, list] = process.argv.slice(2);
  if (!workspace || !list) { console.error('Usage: validators_bridge.mjs <workspace> <names>'); process.exit(2); }
  const root = path.resolve(workspace);
  const names = list.split(',').filter(Boolean);
  const unknown = names.filter(n => n !== 'scene-experience' && !CLI[n]);
  if (unknown.length) { console.error('Unknown validator: ' + unknown.join(',')); process.exit(2); }
  const results = await Promise.all(names.map(name => name === 'scene-experience'
    ? sceneExperience(root).catch(error => ({name, status: 'BLOCKED', issues: [{code: 'VALIDATOR_FAILED', message: String(error.message).slice(0, 400)}]}))
    : cli(root, name)));
  console.log(JSON.stringify({format: 'zodiac-studio-validation@1', results}));
}
main().catch(error => { console.error(error.message); process.exit(2); });
