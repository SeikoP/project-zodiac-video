import {resolveVisualRole} from '../src/visual-role.mjs';
import {resolveCaptionZone} from '../src/caption-layout.mjs';
import {validateCaptionWords} from '../src/caption-karaoke.mjs';
import {auditSpatialLayout} from '../src/spatial-layout.mjs';
import {measurePlanLayout} from './measure-layout.mjs';
import {readFile, writeFile, mkdir} from "node:fs/promises";
import {resolve, join, extname, sep, dirname} from "node:path";
import {fileURLToPath} from "node:url";

const fail = (code, message, detail = {}) => {
  const payload = {
    ok: false,
    code,
    stage: "RENDER",
    message,
    scene_id: /\bscene=([^\s]+)/.exec(message)?.[1] ?? null,
    event_id: null,
    target: /\bentity=([^\s]+)/.exec(message)?.[1] ?? null,
    detail,
  };
  process.stderr.write(JSON.stringify(payload) + "\n");
  process.exitCode = 2;
};

const validInt = (value) => Number.isInteger(value) && value >= 0;

export const validateExecutablePlan = (plan) => {
  if (!plan || typeof plan !== "object" || plan.format !== "zodiac-render-plan@1") {
    throw new Error("render plan format must be zodiac-render-plan@1");
  }
  if (!Number.isInteger(plan.fps) || plan.fps <= 0) {
    throw new Error("render plan fps must be a positive integer");
  }
  if (!Array.isArray(plan.scenes) || plan.scenes.length === 0) {
    throw new Error("render plan must contain at least one scene");
  }
  for (const scene of plan.scenes) {
    if (!validInt(scene.start_frame) || !Number.isInteger(scene.duration_frames) || scene.duration_frames <= 0) {
      throw new Error(`scene ${scene.id ?? "?"} has invalid executable frame bounds`);
    }
    if (!Array.isArray(scene.events)) throw new Error(`scene ${scene.id ?? "?"} events must be an array`);
    for (const caption of scene.captions ?? []) validateCaptionWords(caption);
    for (const event of scene.events) {
      if (!validInt(event.start_frame) || !Number.isInteger(event.end_frame) || event.end_frame <= event.start_frame) {
        throw new Error(`event ${event.event_id ?? "?"} has invalid resolved frame range`);
      }
    }
  }
  return plan;
};

const rectsOverlap = (a, b) =>
  a.x < b.x + b.width && b.x < a.x + a.width &&
  a.y < b.y + b.height && b.y < a.y + a.height;

const transformedBounds = (transform) => {
  const x = Number(transform?.x ?? 0), y = Number(transform?.y ?? 0);
  const width = Number(transform?.width ?? 520), height = Number(transform?.height ?? 520);
  const scale = Math.abs(Number(transform?.scale ?? 1));
  const rad = Number(transform?.rotation ?? 0) * Math.PI / 180;
  const w = scale * (Math.abs(width * Math.cos(rad)) + Math.abs(height * Math.sin(rad))) + 12;
  const h = scale * (Math.abs(width * Math.sin(rad)) + Math.abs(height * Math.cos(rad))) + 12;
  return {x: x + width / 2 - w / 2, y: y + height / 2 - h / 2, width: w, height: h};
};

const classifyVisualRole=(entity,assets)=>{const role=resolveVisualRole(entity,assets);return role==='interactive_prop'?'prop':role==='background'?'environment':role;};

// Distinguish a deliberately slim native writing instrument from a card/board.
// Generic props and effects retain their stricter visual prominence budgets.
export const visualRoleSizeLimit = (role, asset={}) => {
  const path=String(asset?.path??"").replaceAll("\\","/").toLowerCase();
  const master=String(asset?.lineage?.source_master??"").replaceAll("\\","/").toLowerCase();
  const nativePen = role==="prop" &&
    /(^|\/)props\/pen\.svg$/.test(path) &&
    /(^|\/)props\/pen\.svg$/.test(master) &&
    String(asset?.category??"").toLowerCase()==="prop";
  return nativePen
    ? {minimumArea:24000,minimumShortEdge:110,minimumLongEdge:200,profile:"writing-pen"}
    : {minimumArea:role==="effect"?30000:43000,minimumShortEdge:110,minimumLongEdge:0,
       profile:role==="effect"?"effect":"standard-prop"};
};

export const validateVisualRoleSizes = (plan) => {
  for(const scene of plan.scenes??[]){
    if(!scene.layout_contract)continue;
    for(const entity of scene.entities??[]){
      const role=classifyVisualRole(entity,plan.assets);
      if(role!=="prop"&&role!=="effect")continue;
      for(const [stateId,state] of Object.entries(entity.states??{})){
        if(state.visible===false)continue;
        const limit=visualRoleSizeLimit(role,plan.assets?.[state.asset]);
        const scale=Math.abs(Number(state.transform?.scale??1));
        const width=Number(state.transform?.width??0)*scale;
        const height=Number(state.transform?.height??0)*scale;
        const area=width*height;
        if(!Number.isFinite(area)||!Number.isFinite(width)||!Number.isFinite(height)||
           area<limit.minimumArea||Math.min(width,height)<limit.minimumShortEdge||
           Math.max(width,height)<limit.minimumLongEdge){
          throw new Error("VISUAL_ROLE_TOO_SMALL scene="+scene.id+" entity="+entity.id+
            " state="+stateId+" actual="+Math.round(width)+"x"+Math.round(height)+
            " minimum_area="+limit.minimumArea+" profile="+limit.profile);
        }
      }
    }
  }
  return plan;
};

export const validateSceneLayout = (plan) => {
  for (const scene of plan.scenes) {
    const layout = scene.layout_contract;
    if (!layout && !(scene.spatial_bindings?.length)) continue; // Only legacy plans without spatial intent bypass spatial validation.
    const caption = resolveCaptionZone(scene, plan.presentation, plan.video);
    const sceneEntities = new Map((scene.entities ?? []).map(e => [e.id, e]));
    const bindingEntities = new Set();
    for (const binding of scene.spatial_bindings ?? []) {
      if (bindingEntities.has(binding.entity)) throw new Error(`SPATIAL_DUPLICATE scene=${scene.id} entity=${binding.entity}`);
      bindingEntities.add(binding.entity);
      const subject = sceneEntities.get(binding.entity);
      const anchorEntity = sceneEntities.get(binding.anchor);
      if (!subject || !anchorEntity || subject.id === anchorEntity.id) throw new Error(`SPATIAL_ANCHOR_MISSING scene=${scene.id} entity=${binding.entity} anchor=${binding.anchor}`);
      if (!Number.isFinite(binding.max_distance_px) || binding.max_distance_px <= 0) throw new Error(`SPATIAL_LIMIT_MISSING scene=${scene.id} entity=${binding.entity}`);
      // Compare authored positions, not guessed semantics. Across each visible
      // state the center must stay near a visible anchor state.
      const anchorStates = Object.values(anchorEntity.states ?? {}).filter(s => s.visible !== false && s.transform);
      for (const [stateId, state] of Object.entries(subject.states ?? {})) {
        if (state.visible === false || !state.transform) continue;
        const center = t => ({x:Number(t.x ?? 0) + Number(t.width ?? 520)*Number(t.scale ?? 1)/2, y:Number(t.y ?? 0) + Number(t.height ?? 520)*Number(t.scale ?? 1)/2});
        const a = center(state.transform);
        const minDistance = Math.min(...anchorStates.map(s => {const b=center(s.transform);return Math.hypot(a.x-b.x,a.y-b.y);}));
        if (!Number.isFinite(minDistance) || minDistance > binding.max_distance_px)
          throw new Error(`SPATIAL_SEMANTICS_MISMATCH scene=${scene.id} entity=${binding.entity} anchor=${binding.anchor} state=${stateId} relation=${binding.relation} distance=${Math.round(minDistance)} max=${binding.max_distance_px}`);
      }
    }

    let actors = 0, props = 0, effects = 0;
    for (const entity of scene.entities ?? []) {
      const role = classifyVisualRole(entity, plan.assets);
      if (role === "environment" || role === "foreground_environment") continue;
      if (role === "effect") effects++;
      else if (role === "prop") props++;
      else actors++;
      for (const [name, state] of Object.entries(entity.states ?? {})) {
        if (state.visible === false || !state.transform) continue;
        const bounds = transformedBounds(state.transform);
        if (!(scene.captions?.length) && caption && rectsOverlap(caption, bounds)) {
          throw new Error(`LAYOUT_OVERLAP scene=${scene.id} entity=${entity.id} state=${name} caption_safe_zone`);
        }
      }
    }
    const budget = scene.render_density_budget ?? {max_characters:3,max_prominent_props:2,max_prominent_effects:2};
    if (actors > budget.max_characters || props > budget.max_prominent_props || effects > budget.max_prominent_effects ||
        (actors >= 3 && (props > 1 || effects > 1))) {
      throw new Error(`DENSITY_EXCEEDED scene=${scene.id} actors=${actors} props=${props} effects=${effects}`);
    }
  }
  return plan;
};

const hydrateAssets = async (root, assets) => {
  const output = {};
  for (const [assetId, raw] of Object.entries(assets ?? {})) {
    const asset = {...raw};
    if (typeof asset.path === "string") {
      const source = resolve(root, asset.path);
      const relativeSafe = source === root || source.startsWith(root + sep);
      if (!relativeSafe) throw new Error(`asset ${assetId} escapes package root`);
      const bytes = await readFile(source);
      const extension = extname(source).toLowerCase();
      if (extension !== ".svg") {
        throw new Error(`asset ${assetId} has unsupported renderer-v2 media type: ${extension}`);
      }
      asset.src = `data:image/svg+xml;base64,${bytes.toString("base64")}`;
    }
    output[assetId] = asset;
  }
  return output;
};

export const prepareRendererProps = async (packageRoot) => {
  const root = resolve(packageRoot);
  const runtimeDir = join(root, ".runtime");
  const planPath = join(runtimeDir, "render-plan.json");
  let plan;
  try {
    plan = JSON.parse(await readFile(planPath, "utf8"));
  } catch (error) {
    throw new Error(`cannot read render-plan.json: ${error.message}`);
  }
  validateVisualRoleSizes(validateSceneLayout(validateExecutablePlan(plan)));
  // Before rendering, enforce declared visual role assets rather than hiding
  // absent sprites behind placeholder labels.
  for (const scene of plan.scenes) {
    const ids = new Set((scene.entities ?? []).map((e) => e.id));
    const declared = new Set();
    for (const entity of scene.entities ?? []) {
      const role = classifyVisualRole(entity, plan.assets);
      if (role === "prop" || role === "effect") declared.add(role);
      if (!(entity.initial_state in (entity.states ?? {}))) throw new Error(`STATE_MISSING scene=${scene.id} entity=${entity.id}`);
      for (const [stateId, state] of Object.entries(entity.states ?? {})) {
        if (!(state.asset in (plan.assets ?? {}))) throw new Error(`ASSET_MISSING scene=${scene.id} entity=${entity.id} state=${stateId} asset=${state.asset}`);
      }
    }
    for (const event of scene.events ?? []) {
      if (ids.size && !ids.has(event.target)) throw new Error(`EVENT_TARGET_MISSING scene=${scene.id} target=${event.target}`);
    }
    // Count presence as an authoring integrity check; visibility remains
    // under the actual scene timeline and is never faked by the renderer.
    if (declared.has("prop") !== declared.has("effect")) {
      process.stdout.write(`VISUAL_ROLE_PARTIAL scene=${scene.id} roles=${[...declared].join(",")}\n`);
    }
  }

  const presentation = structuredClone(plan.presentation ?? {});
  const requestedFont = String(presentation.caption?.font_family ?? "sans-serif");
  if (requestedFont === "Patrick Hand") {
    const fontPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", "fonts", "PatrickHand-Regular.ttf");
    let fontBytes;
    try {
      fontBytes = await readFile(fontPath);
    } catch (error) {
      throw new Error(`FONT_LOAD_FAILED requested=Patrick Hand path=${fontPath} fallback=false: ${error.message}`);
    }
    if (fontBytes.length < 1024 || !["00010000", "4f54544f", "74727565"].includes(fontBytes.subarray(0, 4).toString("hex"))) {
      // TrueType starts with 00010000; this renderer ships Patrick Hand TTF.
      if (fontBytes.subarray(0, 4).toString("hex") !== "00010000") {
        throw new Error(`FONT_LOAD_FAILED invalid TrueType header at ${fontPath}; fallback=false`);
      }
    }
    if (!presentation.caption) presentation.caption = {};
    presentation.caption.font_data_uri = `data:font/ttf;base64,${fontBytes.toString("base64")}`;
    process.stdout.write(`FONT_REQUESTED=Patrick Hand FONT_SOURCE=${fontPath} FONT_BYTES=${fontBytes.length} FALLBACK=false\\n`);
  } else {
    process.stdout.write(`FONT_REQUESTED=${requestedFont} FONT_SOURCE=system FALLBACK=unspecified\\n`);
  }
  let publish = null;
  try {
    publish = JSON.parse(await readFile(join(root, "publish", "publish.json"), "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw new Error(`PUBLISH_METADATA_INVALID publish/publish.json: ${error.message}`);
    // Synthetic render-plan fixtures used by boundary tests may not carry publish metadata.
  }
  if (publish && (publish.format !== "zodiac-publish@1" || publish.source?.production !== "production.ir.json")) {
    throw new Error("PUBLISH_METADATA_INVALID");
  }
  if (publish?.cover) {
    const source = plan.scenes.find(s => s.id === publish.cover.source_scene_id);
    if (!source) throw new Error(`COVER_SOURCE_SCENE_MISSING ${publish.cover.source_scene_id}`);
    if (!Array.isArray(publish.cover.visuals) || !publish.cover.visuals.length) throw new Error("COVER_VISUALS_MISSING");
    for (const v of publish.cover.visuals) {
      const e = (source.entities ?? []).find(item => item.id === v.entity_id);
      if (!e?.states?.[v.state_id]) throw new Error(`COVER_STATE_MISSING ${v.entity_id}.${v.state_id}`);
      if (!plan.assets[e.states[v.state_id].asset]) throw new Error(`COVER_ASSET_MISSING ${v.entity_id}.${v.state_id}`);
    }
  }
  const measuredPlan = await measurePlanLayout({...plan, presentation, assets: await hydrateAssets(root, plan.assets)});
  const spatialReport = auditSpatialLayout(measuredPlan);
  spatialReport.caption_adjustments = measuredPlan.scenes.flatMap(scene=>(scene.captions??[]).map(caption=>({
    scene:scene.id,frame:caption.start_frame,text:caption.text,
    strategy:"bottom-align-with-padding-inside-resolved-zone",layout:caption.resolved_layout,
  })));
  await writeFile(join(runtimeDir, "spatial-qc-report.json"), JSON.stringify(spatialReport, null, 2) + "\n");
  process.stdout.write(spatialReport.gates.join("\n") + "\n");
  const props = {
    contract: "zodiac-render-plan@1",
    fps: plan.fps,
    video: plan.video,
    presentation,
    ...(plan.performance_context_hash
      ? {performance_context_hash: plan.performance_context_hash}
      : {}),
    assets: measuredPlan.assets,
    scenes: plan.scenes,
    publish,
  };
  await mkdir(runtimeDir, {recursive: true});
  const output = join(runtimeDir, "renderer-v2-props.json");
  await writeFile(output, JSON.stringify(props, null, 2) + "\n", "utf8");
  return {output, props};
};

const main = async () => {
  const root = process.argv[2] ?? process.env.ZODIAC_PACKAGE_ROOT;
  if (!root) {
    fail("RENDER_PLAN_INVALID", "package root is required");
    return;
  }
  try {
    const {output} = await prepareRendererProps(root);
    process.stdout.write(`RENDERER_V2_PREPARED ${output}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(/^(ROLE_|LAYER_|OCCLUSION_|CAPTION_|SPATIAL_)/.test(message) ? message.split(" ")[0] : "RENDER_PLAN_INVALID", message);
  }
};

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await main();
}
