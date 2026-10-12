import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadStepContext} from '../plan-step-context.mjs';

const here=path.dirname(fileURLToPath(import.meta.url)),orchestration=path.resolve(here,'..');

test('default fresh visual compile stays under 70 KB without Story Object compatibility guidance',async()=>{
 const state=JSON.parse(await readFile(path.join(orchestration,'pipeline-state.template.json'),'utf8'));
 const result=await loadStepContext('02-visual-production','visual_compile',state.flags,{environment_mode:'scene_set'});
 const bytes=(result.context_manifest??[]).reduce((sum,row)=>sum+(row.bytes??0),0);
 assert.ok(bytes<=70000,'fresh visual context is '+bytes+' bytes');
 assert.equal(result.required_references.some(ref=>/story-object|compat\/story-object/u.test(ref)),false);
 assert.equal(result.selected_capabilities.includes('visual_metaphor'),false,'metaphor must remain opt-in by default');
});
