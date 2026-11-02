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

test("deep probe uses supported help command and refuses unrelated output",async()=>{
  const {dir,local}=await setup({bin:"dist/cli.cjs"});
  await mkdir(join(local,"dist"),{recursive:true});
  await writeFile(join(local,"dist","cli.cjs"),
    'if (process.argv[2] !== "help") process.exit(1); process.stdout.write("remotion render\\nremotion still");');
  try{
    const cli=await probePinnedRemotionCli(dir);
    assert.equal(cli.version,"4.0.530");
    let invoked;
    const checked=await probePinnedRemotionCli(dir,{spawn:(node,args,options)=>{
      invoked={node,args,options};
      return {status:0,stdout:"remotion render\nremotion still",stderr:""};
    }});
    assert.equal(checked.entry,cli.entry);
    assert.equal(invoked.node,process.execPath);
    assert.deepEqual(invoked.args.slice(1),["help"]);
    assert.equal(invoked.options.cwd,dir);
  }finally{await rm(dir,{recursive:true,force:true})}
});

test("health probe rejects nonzero process status even when usage text looks like help",async()=>{
  const {dir}=await setup({bin:"dist/cli.cjs"});
  const local=join(dir,"node_modules","@remotion","cli");
  await mkdir(join(local,"dist"),{recursive:true});
  await writeFile(join(local,"dist","cli.cjs"),
    'process.stdout.write("remotion render\\nremotion still");');
  try{
    await assert.rejects(probePinnedRemotionCli(dir,{
      spawn:()=>({status:1,stdout:"remotion render\nremotion still",stderr:"Unknown option --version"})
    }),error=>error.code==="RENDERER_DEPENDENCY_BROKEN");
    await assert.rejects(probePinnedRemotionCli(dir,{
      spawn:()=>({status:0,stdout:"Other CLI, no Remotion commands",stderr:""})
    }),error=>error.code==="RENDERER_DEPENDENCY_BROKEN");
  }finally{await rm(dir,{recursive:true,force:true})}
});

test("real locally installed Remotion CLI supports the documented help probe",async(t)=>{
  try{
    await readFile(new URL("../node_modules/@remotion/cli/package.json",import.meta.url),"utf8");
  }catch{t.skip("Local npm dependencies unavailable; CI installs them before npm test");return;}
  const cli=await probePinnedRemotionCli();
  assert.equal(cli.version,"4.0.530");
});

test("health probe allows a slow local CLI startup beyond 15 seconds",async()=>{
  const {dir}=await setup({bin:"dist/cli.cjs"});
  await mkdir(join(dir,"node_modules","@remotion","cli","dist"));
  await writeFile(join(dir,"node_modules","@remotion","cli","dist","cli.cjs"),"");
  try{
    const cli=await probePinnedRemotionCli(dir,{spawn:(_node,_args,options)=>
      options.timeout < 20000
        ? {status:null,error:Object.assign(new Error("timed out"),{code:"ETIMEDOUT"})}
        : {status:0,stdout:"remotion render\nremotion still"}
    });
    assert.equal(cli.version,"4.0.530");
  }finally{await rm(dir,{recursive:true,force:true})}
});

test("health probe timeout remains a failure without suggesting dependency repair",async()=>{
  const {dir}=await setup({bin:"dist/cli.cjs"});
  await mkdir(join(dir,"node_modules","@remotion","cli","dist"));
  await writeFile(join(dir,"node_modules","@remotion","cli","dist","cli.cjs"),"");
  try{
    await assert.rejects(probePinnedRemotionCli(dir,{spawn:()=>({status:null,
      error:Object.assign(new Error("spawnSync ETIMEDOUT"),{code:"ETIMEDOUT"})
    })}),error=>{
      assert.equal(error.code,"RENDERER_CLI_TIMEOUT");
      assert.match(error.message,/60000ms/);
      assert.doesNotMatch(error.message,/npm install|Repair local renderer dependencies/);
      return true;
    });
  }finally{await rm(dir,{recursive:true,force:true})}
});
