import {mkdir} from "node:fs/promises";
import {dirname, resolve} from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {prepareRendererProps} from "./prepare.mjs";

export const renderCover = async (workspace, target) => {
  const {output, props} = await prepareRendererProps(workspace);
  if (!props.publish?.cover) throw new Error("COVER_METADATA_MISSING: publish.cover");
  const dst = resolve(target);
  await mkdir(dirname(dst),{recursive:true});
  const runtime = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const cmd = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(cmd,["remotion","still","src/index.ts","ZodiacCover",dst,`--props=${output}`],{cwd:runtime,stdio:"inherit"});
  if (result.error || result.status !== 0) throw new Error(`COVER_RENDER_FAILED status=${result.status} ${result.error??""}`);
  console.info("COVER_RENDER_PASS " + dst);
  return dst;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2] || !process.argv[3]) throw new Error("Usage: node scripts/render-cover.mjs <workspace> <cover.png>");
  await renderCover(process.argv[2],process.argv[3]);
}
