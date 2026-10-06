import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";
const root=path.dirname(fileURLToPath(import.meta.url));
const read=(name)=>readFile(path.join(root,name),"utf8");

test("fresh-run isolation is explicit in skill and orchestration",async()=>{
  const [skill,orchestration]=await Promise.all([read("../SKILL.md"),read("plugin-orchestration.md")]);
  assert.match(skill,/Fresh Run Isolation/);
  assert.match(skill,/do NOT use account\/personal memory/i);
  assert.match(skill,/do NOT auto-load old approved packages/i);
  assert.match(orchestration,/Default route is FRESH/);
});

test("Gemini continuity example is neutralized",async()=>{
  const example=await read("current-gemini-example.md");
  assert.match(example,/DO NOT AUTO-LOAD THIS FILE/);
  assert.doesNotMatch(example,/Tối nay ăn gì|ramen|Linh|12 tabs/i);
});

test("reference mechanics cannot seed fresh creative content",async()=>{
  const contract=await read("context-isolation.md");
  assert.match(contract,/sign-specific examples/);
  assert.match(contract,/do not provide:[\s\S]*sign selection/i);
  assert.match(contract,/This separation is mandatory to prevent example anchoring/);
});
