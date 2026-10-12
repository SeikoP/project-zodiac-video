#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {validateArchiveFrameWorkspace} from '../../../orchestration/validate-archive-frame.mjs';
import {validateSceneSetIdentityWorkspace} from '../../../features/scene-set/validate-scene-set-identity.mjs';
import {validateSceneSetAccents} from '../../../features/scene-set/validate-scene-set-accents.mjs';
const root=process.argv[2];if(!root)throw Error('workspace required');
if(process.argv.includes('--library-root'))throw Error('RECOVERY_SNAPSHOT_REQUIRED');
const p=JSON.parse(await readFile(path.join(root,'production.json')));
for(const scene of p.scenes??[])if(scene.environment?.profile)throw Error('RECOVERY_SNAPSHOT_REQUIRED '+scene.id);
const checks=[await validateArchiveFrameWorkspace(root),validateSceneSetAccents(p)];
if(p.scenes.some(s=>s.environment?.scene_set_id||s.environment?.scene_set?.id))checks.push(await validateSceneSetIdentityWorkspace(root));
for(const check of checks)if(check.status!=='PASS')throw Error('ENVIRONMENT_BINDING_INVALID '+JSON.stringify(check.issues));
console.log('ENVIRONMENT_BINDING_PASS: current stage hashes and accent containment verified');
