#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compositionHash,designToken,validateComposition,sceneContext} from './phase02-composition-core.mjs';
export {compositionHash,designToken,validateComposition,sceneContext} from './phase02-composition-core.mjs';
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const root=process.argv[2];if(!root)throw new Error('Usage: phase02-composition.mjs <workspace> [--context <scene-id>]');
 const [p,a,d]=await Promise.all([readFile(path.join(root,'production.json'),'utf8'),readFile(path.join(root,'.authoring/scene-art-direction.json'),'utf8'),readFile(path.join(root,'design.md'),'utf8')]);
 const production=JSON.parse(p),plan=JSON.parse(a),token=designToken(d),result=plan.composition_stage==='intent'?await (await import('./resolve-scene-composition.mjs')).inspectResolvedWorkspace(root):validateComposition(production,plan,token);
 const canonicalToken=designToken(await readFile(new URL('../references/design.md',import.meta.url),'utf8'));
 if(compositionHash(token)!==compositionHash(canonicalToken)){result.issues.push({code:'COMPOSITION_CANONICAL_TOKEN_DRIFT'});result.status='BLOCKED';}
 const at=process.argv.indexOf('--context');
 console.log(JSON.stringify(at>=0?{...sceneContext(production,plan,token,process.argv[at+1]),validation:result}:result,null,2));
 if(result.status!=='PASS')process.exitCode=1;
 }catch(e){console.error(e.message);process.exitCode=2;}
}
