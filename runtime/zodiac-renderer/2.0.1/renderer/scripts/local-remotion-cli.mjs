// Launch only the renderer's pinned, locally installed Remotion CLI.
// Never let npx silently fetch a different version from npm.
import {readFile,stat} from "node:fs/promises";
import {spawnSync} from "node:child_process";
import {dirname,isAbsolute,relative,resolve} from "node:path";
import {fileURLToPath} from "node:url";

export const RENDERER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const loadJson = async filepath => JSON.parse(await readFile(filepath, "utf8"));
const isWithin = (parent, child) => {
  const rel = relative(parent,child);
  return rel !== ".." && !rel.startsWith("../") && !rel.startsWith("..\\") && !isAbsolute(rel);
};

export const findPinnedRemotionCli = async (rendererDir = RENDERER_DIR) => {
  const root = resolve(rendererDir);
  const packageJson = await loadJson(resolve(root,"package.json"));
  const expected = packageJson.dependencies?.["@remotion/cli"];
  if(typeof expected !== "string" || !/^\d+\.\d+\.\d+$/.test(expected))
    throw Object.assign(new Error("Renderer package.json must pin @remotion/cli to an exact version"),{code:"RENDERER_CLI_PIN_MISSING"});
  const cliRoot = resolve(root,"node_modules","@remotion","cli");
  let installed;
  try {installed = await loadJson(resolve(cliRoot,"package.json"));}
  catch {throw Object.assign(new Error("Missing @remotion/cli "+expected+
    '. Install renderer dependencies with: npm install --prefix "'+root+'"'),{code:"RENDERER_DEPENDENCY_MISSING"});}
  if(installed.version !== expected)
    throw Object.assign(new Error("Remotion CLI version mismatch: installed "+installed.version+
      ", expected "+expected+'. Reinstall: npm install --prefix "'+root+'"'),{code:"RENDERER_CLI_VERSION_MISMATCH"});
  const bin = typeof installed.bin === "string" ? installed.bin : installed.bin?.remotion;
  if(typeof bin !== "string" || !bin)
    throw Object.assign(new Error("@remotion/cli has no remotion executable declared"),{code:"RENDERER_CLI_BIN_INVALID"});
  const entry = resolve(cliRoot,bin);
  if(!isWithin(cliRoot,entry))
    throw Object.assign(new Error("CLI executable leaves local dependency root"),{code:"RENDERER_CLI_BIN_INVALID"});
  if(!(await stat(entry).catch(()=>null))?.isFile())
    throw Object.assign(new Error("Missing locally installed Remotion CLI entry "+entry+
      '. Reinstall: npm install --prefix "'+root+'"'),{code:"RENDERER_DEPENDENCY_MISSING"});
  return {entry,version:expected,rendererDir:root};
};

export const runPinnedRemotionCli = async (args, opts={}) => {
  const cli=await findPinnedRemotionCli(opts.rendererDir);
  const run=opts.spawn??spawnSync;
  const result=run(process.execPath,[cli.entry,...args],{
    cwd:cli.rendererDir,stdio:"inherit",windowsHide:true
  });
  if(result.error)throw Object.assign(new Error("Remotion CLI failed to start: "+result.error.message),{code:"RENDERER_CLI_LAUNCH_FAILED"});
  return result.status??1;
};

if(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args=process.argv.slice(2);
    if(args.length===1 && args[0]==="--check") {
      const cli=await findPinnedRemotionCli();
      console.log("RENDERER_CLI_READY version="+cli.version+" entry="+cli.entry);
    }else{
      if(args.length===0)throw Object.assign(new Error("Usage: node scripts/local-remotion-cli.mjs <render|still|...> [...]"),{code:"RENDERER_CLI_ARGS_INVALID"});
      process.exitCode=await runPinnedRemotionCli(args);
    }
  }catch(error){
    console.error(JSON.stringify({ok:false,stage:"RENDER",code:error.code??"RENDERER_CLI_LAUNCH_FAILED",message:error.message}));
    process.exitCode=2;
  }
}
