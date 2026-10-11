import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {validateWorkspace} from './validate-environment-frame.mjs';
test('fresh acted environment in 2.4.7 refuses ornamental wallpaper without frame',async()=>{
 const r=await mkdtemp(path.join(os.tmpdir(),'zod-frame-gate-'));
 try{await mkdir(path.join(r,'.authoring'));await writeFile(path.join(r,'.authoring/pipeline-state.json'),JSON.stringify({plugin_version:'2.4.7',run_mode:'fresh'}));
 await writeFile(path.join(r,'production.json'),JSON.stringify({scenes:[{id:'S01',environment:{profile:'bedroom-study-base'},entities:[{id:'lead',kind:'character'}]}]}));
 await assert.rejects(()=>validateWorkspace(r),/FRAME_REQUIRED_FOR_ACTED_ENVIRONMENT/);
 }finally{await rm(r,{recursive:true,force:true});}
});
