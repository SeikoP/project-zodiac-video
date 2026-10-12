import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,cp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import {compileVisualIntent,projectionPaths} from '../compile-visual-intent.mjs';
import {compileVisualGrammar} from '../../references/asset-library-v4/compile-visual-grammar.mjs';
import {compileCharacterAssembly} from '../../references/asset-library-v4/characters/compile-character-assembly.mjs';
import {compileEnvironmentWorkspace} from '../../references/asset-library-v4/environments/compile-environment.mjs';
import {compileProduction} from '../../references/asset-library-v4/scene-direction/compile-scene-direction.mjs';
import {resolveSceneComposition} from '../resolve-scene-composition.mjs';
import {designToken} from '../phase02-composition.mjs';
import {validateStoryObjectPlan} from '../validate-story-object.mjs';
import {validateStoryObjectComposition} from '../validate-story-object-composition.mjs';
import {buildNativePairs} from '../build-native-preview-pairs.mjs';
import {validateNativePairPreview} from '../validate-native-preview-pairs.mjs';
import {compileWorkspace} from '../compile-job-v5.mjs';
const fixture=fileURLToPath(new URL('../../../../../../tests/fixtures/phase2-gemini/',import.meta.url));
test('approved Gemini reproduces cast, staging, symbolic progression, preview and Job5 from a clean workspace',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'gemini-clean-'));try{
 await cp(fixture,root,{recursive:true});const narration=await readFile(path.join(root,'narration.txt'),'utf8'),design=await readFile(path.join(root,'design.md'),'utf8'),intent=JSON.parse(await readFile(path.join(root,'visual-intent.json'))),expected=JSON.parse(await readFile(path.join(root,'expected.json')));await mkdir(path.join(root,'.authoring'));
 await writeFile(path.join(root,'.authoring/visual-intent.json'),JSON.stringify(intent));const out=compileVisualIntent(intent,{narration,token:designToken(design)});for(const [key,rel]of Object.entries(projectionPaths)){await mkdir(path.dirname(path.join(root,rel)),{recursive:true});await writeFile(path.join(root,rel),JSON.stringify(out[key]));}await writeFile(path.join(root,'.authoring/visual-intent-projection-receipt.json'),JSON.stringify(out.receipt));
 let p=compileVisualGrammar(out.production,out.visual_grammar_plan);p=await compileCharacterAssembly(p,out.character_assembly,{root,writeAssets:true});await writeFile(path.join(root,'production.json'),JSON.stringify(p));p=(await compileEnvironmentWorkspace(root)).production;p=(await compileProduction(p,{root})).production??p;await writeFile(path.join(root,'production.json'),JSON.stringify(p));
 for(const s of p.scenes)for(const e of s.entities)assert.deepEqual(e.states,expected.scene_staging[s.id][e.id],s.id+'/'+e.id+' staging');for(const [rel,hash]of Object.entries(expected.native_character_sha256))assert.equal(createHash('sha256').update(await readFile(path.join(root,rel))).digest('hex'),hash,rel);
 const composition=await resolveSceneComposition(p,out.art_direction,designToken(design));assert.equal(composition.status,'PASS',JSON.stringify(composition.issues));assert.equal(validateStoryObjectPlan(out.story_object_plan,p,narration).status,'PASS');assert.equal(validateStoryObjectComposition(out.story_object_plan,p).status,'PASS');const preview=await buildNativePairs(root);assert.ok(preview.authoring_lineage);assert.ok((await validateNativePairPreview(root)).pairs>0);const job=await compileWorkspace(root,{sign:'Song Tử',concept:'Tò mò không phải mau chán'});assert.equal(job.manifest.format,'zodiac-job@5');
 }finally{await rm(root,{recursive:true,force:true})}
});
