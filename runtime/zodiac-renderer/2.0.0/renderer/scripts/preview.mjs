// Renderer-faithful visual review. Does not emulate layout, CSS animation,
// font or visual assets. It renders the same props/frames as final MP4.
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {resolve, dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
import {prepareRendererProps} from "./prepare.mjs";

export const previewFrames = async (workspace, outputDir) => {
  const {output, props} = await prepareRendererProps(workspace);
  const out = resolve(outputDir);
  await mkdir(out, {recursive:true});
  const rendererDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const report = {
    contract:"renderer-faithful-preview@1",
    source:"zodiac-render-plan@1",
    font:props.presentation?.caption?.font_family ?? "sans-serif",
    scenes:[],
  };
  for (const scene of props.scenes) {
    const first = scene.start_frame + Math.min(scene.duration_frames - 1, 12);
    const middle = scene.start_frame + Math.floor(scene.duration_frames / 2);
    const last = scene.start_frame + scene.duration_frames - 1;
    const frames = [...new Set([first, middle, last])];
    for (const frame of frames) {
      const file = `${scene.id}-f${frame}.png`;
      const command = process.platform === "win32" ? "npx.cmd" : "npx";
      const result = spawnSync(command, [
        "remotion","still","src/index.ts","ZodiacRenderPlan",
        join(out,file),`--props=${output}`,`--frame=${frame}`,
      ],{cwd:rendererDir,stdio:"inherit"});
      if (result.error || result.status !== 0) throw new Error(`PREVIEW_RENDER_FAILED scene=${scene.id} frame=${frame} status=${result.status}: ${result.error ?? ""}`);
      report.scenes.push({id:scene.id,frame,file});
    }
  }
  const rows = report.scenes.map((item) => `<figure><img src="${item.file}" alt="${item.id} frame ${item.frame}"><figcaption>${item.id} · frame ${item.frame}</figcaption></figure>`).join("");
  const html = `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Renderer-faithful review</title><style>body{font:16px system-ui;background:#eee9e0;color:#29363d;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(235px,1fr));gap:15px}figure{margin:0;background:white;padding:10px;border-radius:8px}img{width:100%;aspect-ratio:9/16;object-fit:contain}figcaption{padding:6px 0}</style><h1>Render-plan review — Remotion stills</h1><p>Source: render-plan.json · Font: ${report.font} · Same composition as final renderer</p><main>${rows}</main></html>`;
  await writeFile(join(out,"index.html"),html);
  await writeFile(join(out,"preview-report.json"),JSON.stringify(report,null,2)+"\n");
  return report;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const workspace = process.argv[2], output = process.argv[3];
  if (!workspace || !output) throw new Error("Usage: node scripts/preview.mjs <job-workspace> <output-dir>");
  const report = await previewFrames(workspace,output);
  console.log(`RENDERER_PREVIEW_PASS frames=${report.scenes.length}`);
}
