#!/usr/bin/env node
// Called BEFORE Phase-02 native asset generation. Legacy v1 imports still compile;
// a fresh v2.4.5 run must author the story-first @2 design plan.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateCharacterDesignIntent} from '../../references/asset-library-v4/characters/character-design-intent.mjs';
export const mustUseIntentV2=state=>{
 const [a,b,c]=String(state?.plugin_version??'0.0.0').split('.').map(Number);
 return state?.run_mode==='fresh'&&(a>2||(a===2&&(b>4||(b===4&&c>=5))));
};
export async function validateCharacterIntentPreflight(root){
 const read=async rel=>JSON.parse(await readFile(path.join(root,rel),'utf8'));
 const [state,production,plan]=await Promise.all([read('.authoring/pipeline-state.json'),read('production.json'),read('.authoring/character-assembly-plan.json')]);
 return validateCharacterDesignIntent(production,plan,{requireV2:mustUseIntentV2(state)});
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){try{const p=process.argv[2];if(!p)throw Error('workspace path required');const r=await validateCharacterIntentPreflight(path.resolve(p));console.log('CHARACTER_INTENT_PREFLIGHT_PASS '+JSON.stringify(r));}catch(e){console.error('CHARACTER_INTENT_PREFLIGHT_BLOCKED '+e.message);process.exitCode=2;}}
