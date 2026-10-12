#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const fail=message=>{throw new Error('MEME_SELECTION_STATE_INVALID: '+message);};
const readJson=async file=>JSON.parse(await readFile(file,'utf8'));

export async function validateMemeSelection(packageRoot,{planPath,statePath}={}){
  const root=path.resolve(packageRoot);
  const planFile=planPath?path.resolve(planPath):path.join(root,'visual-grammar-plan.json');
  const stateFile=statePath?path.resolve(statePath):path.join(root,'.authoring','pipeline-state.json');
  let plan,state;
  try{plan=await readJson(planFile);}catch{fail(`visual grammar plan missing or unreadable at ${path.relative(root,planFile)}`);}
  try{state=await readJson(stateFile);}catch{fail(`pipeline state missing or unreadable at ${path.relative(root,stateFile)}`);}
  if(plan?.format!=='zodiac-visual-grammar-plan@1'||!Array.isArray(plan.scenes))fail('visual grammar plan must use zodiac-visual-grammar-plan@1');
  if(typeof state?.flags?.meme_selected!=='boolean')fail('pipeline state flags.meme_selected must be boolean');
  const registry=await readJson(path.join(here,'../../references/asset-library-v4/memes/index.json'));
  const known=new Set((registry.compositions??[]).map(x=>x.id));
  let selected=false;
  for(const scene of plan.scenes){
    if(scene?.meme_composition===undefined)continue;
    selected=true;
    const request=scene.meme_composition;
    if(!request||typeof request!=='object'||Array.isArray(request)||typeof request.id!=='string'||!request.id.trim())fail(`${scene.scene_id??'(scene)'} has invalid meme composition selection`);
    if(!known.has(request.id))fail(`${scene.scene_id??'(scene)'} unknown meme composition ${request.id}`);
  }
  if(selected!==state.flags.meme_selected){
    if(selected)fail('meme_selected must be true when a visual scene selects a meme composition');
    fail('no meme composition is selected while meme_selected is true');
  }
  return {selected,scenes:plan.scenes.length};
}

const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
  const root=process.argv[2];
  if(!root){console.error('Usage: node validate-meme-selection.mjs <package-root> [visual-grammar-plan.json] [pipeline-state.json]');process.exit(2);}
  const result=await validateMemeSelection(root,{planPath:process.argv[3],statePath:process.argv[4]});
  console.log(`MEME_SELECTION_PASS: selected=${result.selected} scenes=${result.scenes}`);
}
