import {readFile, writeFile, mkdir} from "node:fs/promises";
import {resolve, join, extname} from "node:path";

const fail = (code, message, detail = {}) => {
  const payload = {
    ok: false,
    code,
    stage: "RENDER",
    message,
    scene_id: null,
    event_id: null,
    target: null,
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
    for (const event of scene.events) {
      if (!validInt(event.start_frame) || !Number.isInteger(event.end_frame) || event.end_frame <= event.start_frame) {
        throw new Error(`event ${event.event_id ?? "?"} has invalid resolved frame range`);
      }
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
      const relativeSafe = source === root || source.startsWith(root + "/");
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
  validateExecutablePlan(plan);
  const props = {
    contract: "zodiac-render-plan@1",
    fps: plan.fps,
    video: plan.video,
    assets: await hydrateAssets(root, plan.assets),
    scenes: plan.scenes,
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
    fail("RENDER_PLAN_INVALID", error instanceof Error ? error.message : String(error));
  }
};

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await main();
}
