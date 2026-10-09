import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm,mkdir,writeFile,readFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {findPinnedRemotionCli,probePinnedRemotionCli,runPinnedRemotionCli} from "../scripts/local-remotion-cli.mjs";

const setup = async ({installed=true,installedVersion="4.0.530",bin="../dist/cli.cjs"}={})=>{
  const dir=await mkdtemp(join(tmpdir(),"zodiac-local-cli-"));
  const local=join(dir,"node_modules","@remotion","cli");
  await mkdir(local,{recursive:true});
  await writeFile(join(dir,"package.json"),JSON.stringify({dependencies:{"@remotion/cli":"4.0.530"}}));
  if(installed){
    await writeFile(join(local,"package.json"),JSON.stringify({version:installedVersion,bin:{remotion:bin}}));
    if(bin==="../dist/cli.cjs"){await mkdir(join(dir,"node_modules","@remotion","dist"),{recursive:true});
      await writeFile(join(dir,"node_modules","@remotion","dist","cli.cjs"),"process.stdout.write('OK');");
    }
  }
  return {dir,local};
};

test("missing local dependency fails with exact npm install instruction",async()=>{
  const {dir}=await setup({installed:false});
  try{
    await assert.rejects(findPinnedRemotionCli(dir),err=>err.code==="RENDERER_DEPENDENCY_MISSING"&&err.message.includes("npm install --prefix"));
  }finally{await rm(dir,{recursive:true,force:true})}
});
test("mismatched pinned version is rejected, never fetched by npx",async()=>{
  const {dir}=await setup({installedVersion:"4.0.529"});
  try{
    await assert.rejects(findPinnedRemotionCli(dir),err=>err.code==="RENDERER_CLI_VERSION_MISMATCH");
  }finally{await rm(dir,{recursive:true,force:true})}
});
test("local executable path traversal is blocked",async()=>{
  const {dir}=await setup({bin:"../../../outside.cjs"});
  try{await assert.rejects(findPinnedRemotionCli(dir),err=>err.code==="RENDERER_CLI_BIN_INVALID")}
  finally{await rm(dir,{recursive:true,force:true})}
});
test("missing bin file is a renderer dependency error",async()=>{
  const {dir}=await setup({bin:"dist/missing.js"});
  try{await assert.rejects(findPinnedRemotionCli(dir),err=>err.code==="RENDERER_DEPENDENCY_MISSING")}
  finally{await rm(dir,{recursive:true,force:true})}
});
test("local CLI is resolved and launched with node using the pinned entry",async()=>{
  const {dir}=await setup({bin:"dist/cli.cjs"});
  const local=join(dir,"node_modules","@remotion","cli");
  await mkdir(join(local,"dist"));
  await writeFile(join(local,"dist","cli.cjs"),"process.stdout.write('OK');");
  try{
    const cli=await findPinnedRemotionCli(dir);
    assert.equal(cli.version,"4.0.530");
    let call=null;
    const status=await runPinnedRemotionCli(["render","src/index.ts"],{
      rendererDir:dir,spawn:(bin,args,options)=>{call={bin,args,options};return {status:0};}
    });
    assert.equal(status,0);
    assert.equal(call.bin,process.execPath);
    assert.deepEqual(call.args.slice(1),["render","src/index.ts"]);
    assert.equal(call.args[0],cli.entry);
    assert.equal(call.options.cwd,dir);
  }finally{await rm(dir,{recursive:true,force:true})}
});
test("preview and cover must use same pinned CLI launcher as full render",async()=>{
  const source=await readFile(new URL("../scripts/preview.mjs",import.meta.url),"utf8");
  const cover=await readFile(new URL("../scripts/render-cover.mjs",import.meta.url),"utf8");
  for(const content of [source,cover]){
    assert.match(content,/local-remotion-cli\.mjs/);
    assert.doesNotMatch(content,/npx\.cmd|["']npx["']/);
  }
});

test("deep CLI check catches actual MODULE_NOT_FOUND isexe despite installed entry",async()=>{
  const {dir,local}=await setup({bin:"dist/cli.cjs"});
  await mkdir(join(local,"dist"),{recursive:true});
  await writeFile(join(local,"dist","cli.cjs"),
    'require("isexe");console.log("4.0.530");');
  try {
    const cli=await findPinnedRemotionCli(dir);
    assert.ok(cli.entry.endsWith("cli.cjs")); // old --check would wrongly PASS here
    await assert.rejects(probePinnedRemotionCli(dir),error=>
      error.code==="RENDERER_DEPENDENCY_BROKEN" &&
      /isexe/.test(error.message) &&
      /npm install --prefix/.test(error.message));
  }finally{await rm(dir,{recursive:true,force:true})}
});

test("deep probe requires CLI to boot and checks --version, not file presence",async()=>{
  const {dir,local}=await setup({bin:"dist/cli.cjs"});
  await mkdir(join(local,"dist"),{recursive:true});
  await writeFile(join(local,"dist","cli.cjs"),
    'process.stdout.write("4.0.530");');
  try{
    const cli=await probePinnedRemotionCli(dir);
    assert.equal(cli.version,"4.0.530");
    let invoked;
    const checked=await probePinnedRemotionCli(dir,{spawn:(node,args,options)=>{
      invoked={node,args,options};
      return {status:0,stdout:"4.0.530",stderr:""};
    }});
    assert.equal(checked.entry,cli.entry);
    assert.equal(invoked.node,process.execPath);
    assert.deepEqual(invoked.args.slice(1),["--version"]);
    assert.equal(invoked.options.cwd,dir);
  }finally{await rm(dir,{recursive:true,force:true})}
});
