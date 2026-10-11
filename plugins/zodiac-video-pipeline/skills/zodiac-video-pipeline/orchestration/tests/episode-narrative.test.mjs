import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';import {plan,narration} from './helpers/episode-fixture.mjs';
const script=fileURLToPath(new URL('../../references/validate-narrative.mjs',import.meta.url));
async function run(mutate){const root=await mkdtemp(path.join(tmpdir(),'episode-narrative-'));try{const p=plan();p.story_spine.starting_read='Cả nhóm đều nóng tính';mutate?.(p);await writeFile(path.join(root,'plan.json'),JSON.stringify(p));await writeFile(path.join(root,'narration.txt'),narration());return spawnSync(process.execPath,[script,path.join(root,'plan.json'),path.join(root,'narration.txt')],{encoding:'utf8'});}finally{await rm(root,{recursive:true,force:true});}}
test('Narrative2.1 validates actual group narration with no primary sign',async()=>{const r=await run();assert.equal(r.status,0,r.stderr);});
test('Narrative2.1 still enforces rhythm, member coverage and valid scope',async()=>{
 for(const mutate of [p=>delete p.beats[0].performance,p=>p.beats[0].voice_anchor='missing phrase',p=>p.beats[0].member_ids=['virgo'],p=>p.beats.pop(),p=>p.episode_scope.member_ids=['aries','leo','virgo']])assert.notEqual((await run(mutate)).status,0);
});
