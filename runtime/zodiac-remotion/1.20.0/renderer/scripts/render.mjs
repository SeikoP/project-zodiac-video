import {access, copyFile, mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
import Ajv2020 from "ajv/dist/2020.js";
import {generateSfx} from "./generate-sfx.mjs";
import {resolveProductionEvents, validateEventStates, validateNarrationProgressionProxy, validateVisualProgression} from "../src/runtime-contract.mjs";
import {validateSemanticAnimation} from "../src/semantic-animation.mjs";
import {materializeProductionDefaults, validatePerformanceAnimation, validatePerformanceTiming} from "../src/performance-animation.mjs";
import {parseDesignToken, styleTokenHash} from "./style-token.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rendererDir = path.resolve(scriptDir, "..");
const packageRoot = process.env.ZODIAC_PACKAGE_ROOT ? path.resolve(process.env.ZODIAC_PACKAGE_ROOT) : path.resolve(rendererDir, "..");
const fail = (message) => { console.error("RENDER_BLOCKED: " + message); process.exit(1); };
const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
const hasFile = async (filePath) => access(filePath).then(() => true).catch(() => false);
const normalize = (value) => String(value).normalize("NFC").toLocaleLowerCase("vi-VN").replace(/[\p{P}\p{S}]/gu, " ").trim().replace(/\s+/gu, " ");

let production;
let timing;
try {
  production = JSON.parse(await readFile(path.join(packageRoot, "production.json"), "utf8"));
  timing = JSON.parse(await readFile(path.join(packageRoot, ".runtime", "timing.json"), "utf8"));
} catch (error) {
  fail("could not read production.json or .runtime/timing.json: " + error.message);
}
const schema = JSON.parse(await readFile(path.join(rendererDir, "schemas", "production.schema.json"), "utf8"));
const validateSchema = new Ajv2020({allErrors: true, strict: false}).compile(schema);
if (!validateSchema(production)) fail("production.json does not match v2.0 schema: " + JSON.stringify(validateSchema.errors));
try { production = materializeProductionDefaults(production); } catch (error) { fail(error.message); }
if (production.version !== "2.0") fail("production.json must use contract version 2.0.");
if (production.video.width !== 1080 || production.video.height !== 1920) fail("video dimensions must be 1080x1920.");
if (production.caption_style.font_family !== "Patrick Hand" || production.caption_style.font_weight !== 400) fail("caption_style must use bundled Patrick Hand weight 400.");
if (!(await hasFile(path.join(packageRoot, "design.md")))) fail("design.md is required as the canonical visual-language source.");
let designToken;
try { designToken = parseDesignToken(await readFile(path.join(packageRoot, "design.md"), "utf8")); } catch (error) { fail(error.message); }
if (production.visual_system.style_token?.source_hash !== styleTokenHash(designToken)) fail("production.json style token is stale; run npm run compile:style from the package root.");
const captionToken = designToken.caption_emphasis;
const caption = production.caption_style;
const sameSafeZone = ["x", "y", "width", "height"].every((key) => caption.safe_area?.[key] === designToken.safe_zone?.[key]);
if (
  caption.font_family !== captionToken.font_family ||
  caption.font_weight !== captionToken.font_weight ||
  caption.font_size_px !== captionToken.font_size_px ||
  caption.min_font_size_px !== captionToken.min_font_size_px ||
  caption.max_lines !== captionToken.max_lines ||
  !sameSafeZone ||
  (captionToken.ghost_frame === true && caption.background !== "transparent")
) fail("caption_style must exactly match design.md caption_emphasis/safe_zone, including the transparent handwritten overlay contract.");

let packageManifest = null;
const packageManifestPath = path.join(packageRoot, "package-manifest.json");
if (await hasFile(packageManifestPath)) {
  try { packageManifest = JSON.parse(await readFile(packageManifestPath, "utf8")); } catch (error) { fail("package-manifest.json is invalid: " + error.message); }
}
const localFirstV4 = packageManifest?.format === "zodiac-job@4";
if (!localFirstV4) {
  let handoff;
  try { handoff = JSON.parse(await readFile(path.join(packageRoot, "handoff-manifest.json"), "utf8")); } catch (error) { fail("handoff-manifest.json is required and must be valid JSON: " + error.message); }
  if (!handoff.package_id || !handoff.plugin_version || !Array.isArray(handoff.status) || !handoff.status.some((value) => ["LOCAL_RUNTIME_PENDING", "RENDER_READY"].includes(value))) {
    fail("handoff-manifest.json must identify package/plugin and declare LOCAL_RUNTIME_PENDING or RENDER_READY.");
  }
}
if (!(await hasFile(path.join(packageRoot, "voice.wav")))) fail("voice.wav is missing; create it from narration.txt first.");
let narration;
try { narration = await readFile(path.join(packageRoot, "narration.txt"), "utf8"); } catch { fail("narration.txt is missing."); }
const expectedNarration = production.scenes.map((scene) => scene.voice).join("\n");
let normalizedNarration = narration.replace(/\r\n/g, "\n");
if (normalizedNarration.endsWith("\n")) normalizedNarration = normalizedNarration.slice(0, -1);
if (normalizedNarration !== expectedNarration) fail("narration.txt must exactly match ordered scene.voice lines, with only one optional final LF.");
const safe = production.caption_style.safe_area;
if (!safe || safe.x < 64 || safe.y < 80 || safe.width <= 0 || safe.x + safe.width > production.video.width - 64 || safe.y + safe.height > production.video.height - 300) fail("caption safe area must preserve edge and bottom TikTok UI clearance.");
if (!production.visual_system.style_token?.id) fail("compiled visual_system.style_token needs an ID from design.md.");
if (timing.fps !== production.video.fps) fail("timing.json fps must match production.json.");
if (!Array.isArray(timing.scenes) || timing.scenes.length !== production.scenes.length) fail("timing.json must contain one ordered scene entry per production scene.");

const eventIds = new Set();
let cursor = 0;
for (let i = 0; i < production.scenes.length; i++) {
  const scene = production.scenes[i];
  const row = timing.scenes[i];
  if (row.scene_id !== scene.id) fail("timing.json scene order/id mismatch at " + scene.id + ".");
  if (!Number.isInteger(row.start_frame) || row.start_frame < 0 || !Number.isInteger(row.duration_frames) || row.duration_frames < 1) fail("scene timing must use measured non-negative start_frame and positive duration_frames.");
  if (row.start_frame !== cursor) fail("scene frame ranges must be continuous and ordered from measured voice timing.");
  cursor = row.start_frame + row.duration_frames;
  if (!Array.isArray(row.captions) || row.captions.length === 0) fail("word-level measured captions are required for " + scene.id + ".");
  if (row.captions.some((word) => typeof word.text !== "string" || /\s/u.test(word.text.trim()) || !word.text.trim() || !isFiniteNumber(word.startMs) || !isFiniteNumber(word.endMs) || word.endMs <= word.startMs)) fail("caption timings must contain one measured word token per row in " + scene.id + ".");
  if (normalize(row.captions.map((word) => word.text).join(" ")) !== normalize(scene.voice)) fail("word-level caption tokens do not exactly cover scene.voice in " + scene.id + ".");
  let previousEnd = -1;
  for (const word of row.captions) {
    if (word.startMs < previousEnd) fail("caption word timings overlap or are out of order in " + scene.id + ".");
    if (word.startMs < row.start_frame * 1000 / timing.fps - 100 || word.endMs > (row.start_frame + row.duration_frames) * 1000 / timing.fps + 100) fail("caption word falls outside measured scene timing in " + scene.id + ".");
    previousEnd = word.endMs;
  }
  if (!Array.isArray(scene.entities) || !Array.isArray(scene.events) || scene.events.length === 0) fail("each scene requires visual entities and at least one story-changing event: " + scene.id);
  try { validateEventStates(scene); } catch (error) { fail(error.message); }
  try { validateSemanticAnimation(scene); } catch (error) { fail(error.message); }
  try { validatePerformanceAnimation(scene); } catch (error) { fail(error.message); }
  try { validateNarrationProgressionProxy(scene); } catch (error) { fail(error.message); }
  for (const entity of scene.entities) {
    if (!entity.id || !entity.states?.[entity.initial_state]) fail("entity initial state is missing in " + scene.id + ".");
    for (const [stateId, state] of Object.entries(entity.states)) {
      if (Boolean(state.asset) === Boolean(state.primitive)) fail("state must reference exactly one asset or primitive: " + entity.id + "." + stateId);
      if (!state.transform || ![state.transform.x, state.transform.y, state.transform.width, state.transform.height, state.layer].every(isFiniteNumber)) fail("state has an invalid transform or layer: " + entity.id + "." + stateId);
      if (state.asset) {
        const asset = production.assets[state.asset];
        if (!asset) fail("missing asset registry ID " + state.asset + ".");
        if (!asset.path.startsWith("assets/") || asset.path.includes("..\\") || asset.path.includes("../")) fail("SVG asset path must stay under package assets/: " + asset.path);
        const assetPath = path.resolve(packageRoot, asset.path);
        if (!assetPath.startsWith(path.resolve(packageRoot, "assets") + path.sep)) fail("SVG asset path escapes assets/: " + asset.path);
        if (!(await hasFile(assetPath))) fail("missing SVG asset file " + asset.path + ".");
        const svg = await readFile(assetPath, "utf8");
        if (!/^\s*<svg\b[\s\S]*<\/svg>\s*$/iu.test(svg) || /<script\b|<foreignObject\b|<image\b|(?:href|src)\s*=|url\(/iu.test(svg)) fail("SVG must be a self-contained, script-free vector asset: " + asset.path);
        if (asset.style_id !== production.visual_system.style_token.id) fail("asset style_id does not match compiled design token: " + asset.path);
      }
      if (state.primitive && !production.primitives[state.primitive]) fail("missing primitive ID " + state.primitive + ".");
    }
  }
  for (const event of scene.events) {
    if (!event.id || eventIds.has(event.id)) fail("event IDs must be unique across the package.");
    eventIds.add(event.id);
    if (!event.motion?.preset || !Number.isInteger(event.motion.duration_frames) || event.motion.duration_frames < 1) fail("event has invalid motion or duration: " + event.id);
    if (!production.visual_system.motion_presets[event.motion.preset]) fail("missing motion preset " + event.motion.preset + ".");
    if (event.trigger.source === "voice_anchor" && !event.trigger.text?.trim()) fail("voice_anchor needs exact text: " + event.id);
    if (event.sfx && !production.visual_system.sfx_profiles[event.sfx]) fail("missing SFX profile " + event.sfx + ".");
  }
  const transition = production.visual_system.transition_presets[scene.transition.type];
  if (!transition || !["instant_cut", "clip_reveal", "opacity_to_zero"].includes(transition.renderer)) fail("unsupported or missing transition preset in " + scene.id + ".");
}
if (timing.total_duration_frames !== cursor) fail("total_duration_frames must equal the final measured scene boundary.");

let resolvedEvents;
try { resolvedEvents = resolveProductionEvents(production, timing); } catch (error) { fail(error.message); }
for (const scene of production.scenes) {
  const row = timing.scenes.find((item) => item.scene_id === scene.id);
  try { validateVisualProgression(scene, row, resolvedEvents, timing.fps); } catch (error) { fail(error.message); }
  try { validatePerformanceTiming(scene, resolvedEvents); } catch (error) { fail(error.message); }
  const priorByTarget = new Map();
  let priorFrame = -1;
  for (const event of scene.events) {
    const resolved = resolvedEvents[event.id];
    if (resolved < priorFrame) fail("events must be listed in resolved time order in " + scene.id + ".");
    priorFrame = resolved;
    if (event.target !== "camera") {
      const priorEnd = priorByTarget.get(event.target);
      if (priorEnd !== undefined && resolved < priorEnd) fail("events on the same target cannot overlap: " + event.id);
      priorByTarget.set(event.target, resolved + event.motion.duration_frames);
    }
  }
}
const renderPropsPath = path.join(packageRoot, ".runtime", "render-props.json");
const publishDir = path.join(packageRoot, "publish");
const publishJsonPath = path.join(publishDir, "publish.json");
const publishCopyPath = path.join(publishDir, "publish-copy.txt");
if (!(await hasFile(publishJsonPath)) || !(await hasFile(publishCopyPath))) fail("publish/publish.json and publish/publish-copy.txt are required for final local rendering.");
let publish;
try { publish = JSON.parse(await readFile(publishJsonPath, "utf8")); } catch (error) { fail("publish.json is invalid: " + error.message); }
if (!publish.cover?.identity?.label || !publish.cover?.identity?.glyph || !publish.cover?.hook) fail("COVER_IDENTITY_MISSING: cover identity label/glyph and hook are required.");
if (publish.cover.layout !== "tilted_top_hook") fail("cover.layout must be tilted_top_hook.");
await writeFile(renderPropsPath, JSON.stringify({...timing, resolved_events: resolvedEvents, production, publish}, null, 2) + "\n", "utf8");
await generateSfx(production, path.join(packageRoot, ".runtime", "sfx"));
const publicArg="--public-dir="+packageRoot;
const propsArg="--props="+renderPropsPath;
if(process.argv.includes("--prepare-only")){console.log("Prepared .runtime/render-props.json for preview.");process.exit(0);}
const cli=path.join(rendererDir,"node_modules",".bin",process.platform==="win32"?"remotion.cmd":"remotion");
if(!(await hasFile(cli))) fail("Remotion CLI is missing; install the exact pinned dependencies in renderer/ first.");
if(process.argv.includes("--studio")){const studioResult=spawnSync(cli,["studio","src/index.ts",propsArg,publicArg],{cwd:rendererDir,stdio:"inherit",shell:process.platform==="win32"});if(studioResult.error)fail(studioResult.error.message);process.exit(studioResult.status??0);}

await mkdir(path.join(packageRoot, "out"), {recursive: true});
const videoArgs=["render","src/index.ts","ZodiacVideo",path.join(packageRoot,"out","zodiac-story.mp4"),propsArg,publicArg,"--codec=h264"];
const videoResult = spawnSync(cli, videoArgs, {cwd: rendererDir, stdio: "inherit", shell: process.platform === "win32"});
if (videoResult.error) fail(videoResult.error.message);
if (videoResult.status !== 0) process.exit(videoResult.status ?? 1);
const coverArgs=["still","src/index.ts","ZodiacCover",path.join(packageRoot,"out","cover.png"),propsArg,publicArg];
const coverResult = spawnSync(cli, coverArgs, {cwd: rendererDir, stdio: "inherit", shell: process.platform === "win32"});
if (coverResult.error) fail(coverResult.error.message);
if (coverResult.status !== 0) process.exit(coverResult.status ?? 1);
await copyFile(publishCopyPath, path.join(packageRoot, "out", "publish-copy.txt"));
await copyFile(publishJsonPath, path.join(packageRoot, "out", "publish.json"));
console.log("Rendered job video/cover and copied publish text/metadata into out/.");
