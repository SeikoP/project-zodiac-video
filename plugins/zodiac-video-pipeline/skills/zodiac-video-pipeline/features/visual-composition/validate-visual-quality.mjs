#!/usr/bin/env node
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';import path from 'node:path';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));const arg=process.argv[2];if(!arg){console.error('Usage: node validate-visual-quality.mjs <package-root|production.json>');process.exit(2);}const root=arg.endsWith('.json')?path.dirname(arg):arg;
const stages=[
 ...(existsSync(path.join(root,'.authoring/visual-intent.json'))?[[path.join(here,'validate-phase02-art-direction.mjs'),[root]]]:[]),
 [path.join(here,'validate-visual-structure.mjs'),[arg]],
 [path.resolve(here,'../../references/asset-library-v4/validation/validate-production-style.mjs'),[root]],
 [path.join(here,'validate-semantic-asset-fit.mjs'),[root]]
];
for(const [script,args] of stages){const r=spawnSync(process.execPath,[script,...args],{encoding:'utf8'});if(r.stdout)process.stdout.write(r.stdout);if(r.status!==0){if(r.stderr)process.stderr.write(r.stderr);process.exit(r.status??1);}}
console.log('VISUAL_SEMANTIC_FIT_PASS');console.log('VISUAL_QUALITY_PASS');
