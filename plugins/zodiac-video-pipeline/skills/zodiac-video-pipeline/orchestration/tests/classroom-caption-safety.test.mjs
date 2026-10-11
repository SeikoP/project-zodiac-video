import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {materializeEnvironment} from '../../references/asset-library-v4/environments/compile-environment.mjs';
const index=JSON.parse(await readFile(new URL('../../references/asset-library-v4/environments/composition-index.json',import.meta.url),'utf8'));
test('background-only compiler does not auto-generate classroom desk in any supported shot',()=>{
 const shots=['wide-environment','medium-character','reaction-closeup','prop-insert','caption-led'];
 const input={version:'2.0',scenes:shots.map((shot,i)=>({id:'S'+i,environment:{profile:'classroom-study',modifier:'clean'},scene_direction:{shot,subject_placement:'center'},entities:[]})),assets:{}};
 const output=materializeEnvironment(input,index);
 for(const s of output.scenes){const x=s.entities.find(e=>e.id==='env__classroom-desk-edge');assert.equal(x,undefined,`${s.id}: no automatic desk`);}
});
