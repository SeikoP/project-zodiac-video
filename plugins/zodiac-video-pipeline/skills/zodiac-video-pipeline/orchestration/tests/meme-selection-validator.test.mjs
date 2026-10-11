import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {validateMemeSelection} from '../validate-meme-selection.mjs';

async function workspace({selected=false,flag=selected}={}){
  const root=await mkdtemp(path.join(os.tmpdir(),'meme-selection-'));
  await mkdir(path.join(root,'.authoring'),{recursive:true});
  const plan={format:'zodiac-visual-grammar-plan@1',scenes:selected?[{scene_id:'S01',meme_composition:{id:'facepalm-closeup',bindings:{actor:'hero'}}}]:[{scene_id:'S01'}]};
  const state={format:'zodiac-pipeline-state@2',flags:{meme_selected:flag}};
  await writeFile(path.join(root,'visual-grammar-plan.json'),JSON.stringify(plan));
  await writeFile(path.join(root,'.authoring','pipeline-state.json'),JSON.stringify(state));
  return root;
}

test('non-meme plan passes when meme_selected is false',async()=>{
  const root=await workspace();try{assert.deepEqual(await validateMemeSelection(root),{selected:false,scenes:1});}finally{await rm(root,{recursive:true,force:true});}
});
test('selected meme cannot be skipped by leaving meme_selected false',async()=>{
  const root=await workspace({selected:true,flag:false});try{await assert.rejects(()=>validateMemeSelection(root),/MEME_SELECTION_STATE_INVALID.*meme_selected must be true/u);}finally{await rm(root,{recursive:true,force:true});}
});
test('meme_selected true requires a selected adapter in the visual plan',async()=>{
  const root=await workspace({selected:false,flag:true});try{await assert.rejects(()=>validateMemeSelection(root),/MEME_SELECTION_STATE_INVALID.*no meme composition/u);}finally{await rm(root,{recursive:true,force:true});}
});
test('selected meme passes when state and plan agree',async()=>{
  const root=await workspace({selected:true,flag:true});try{assert.deepEqual(await validateMemeSelection(root),{selected:true,scenes:1});}finally{await rm(root,{recursive:true,force:true});}
});
test('unknown adapter ids fail before Semantic Assets',async()=>{
  const root=await workspace({selected:true,flag:true});try{const file=path.join(root,'visual-grammar-plan.json');const plan=JSON.parse(await (await import('node:fs/promises')).readFile(file,'utf8'));plan.scenes[0].meme_composition.id='old-unregistered';await writeFile(file,JSON.stringify(plan));await assert.rejects(()=>validateMemeSelection(root),/unknown meme composition/u);}finally{await rm(root,{recursive:true,force:true});}
});
