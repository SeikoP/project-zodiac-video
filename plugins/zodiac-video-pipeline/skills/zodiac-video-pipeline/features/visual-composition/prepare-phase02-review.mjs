#!/usr/bin/env node
// Prepare a deterministic human Visual Review directory. Diagnostic only; never a production ZIP.
import {access,cp,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const exists=p=>access(p).then(()=>true).catch(()=>false);
const sha=b=>createHash('sha256').update(b).digest('hex');
const safeRel=s=>{const n=String(s).replaceAll('\\','/');if(!n||n.startsWith('/')||n.split('/').includes('..'))throw Error('UNSAFE_REVIEW_PATH '+n);return n;};
async function copyIf(root,out,rel){rel=safeRel(rel);const src=path.join(root,rel);if(!(await exists(src)))return false;await mkdir(path.dirname(path.join(out,rel)),{recursive:true});await cp(src,path.join(out,rel),{recursive:true});return true;}
async function files(dir,base=dir,out=[]){for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await files(p,base,out);else if(e.isFile())out.push(path.relative(base,p).replaceAll('\\','/'));}return out;}
function activeStyle(raw){const m=raw.match(/<!-- STYLE_TOKEN_BEGIN -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- STYLE_TOKEN_END -->/u);if(!m)throw Error('ACTIVE_STYLE_TOKEN_MISSING');const token=JSON.parse(m[1]);if(token.version!=='4.0'||token.id!=='zodiac-paper-doodle-meme-v4')throw Error('ACTIVE_STYLE_TOKEN_UNEXPECTED');return token;}
export async function preparePhase02Review(workspace,outDir){
 const root=path.resolve(workspace),out=path.resolve(outDir);
 const state=JSON.parse(await readFile(path.join(root,'.authoring','pipeline-state.json'),'utf8'));
 const phase=state.phases?.['02-visual-production'];
 if(state.current_phase!=='02-visual-production'||phase?.status!=='IN_REVIEW')throw Error('PHASE02_NOT_IN_REVIEW');
 const report=JSON.parse(await readFile(path.join(root,'.authoring','preview-pairs','preview-report.json'),'utf8'));
 if(report.format!=='zodiac-native-preview-pairs@2'||report.review_surface!=='scene_complete_plus_event_pairs'||report.scene_count!==report.scene_frames?.length)throw Error('SCENE_COMPLETE_PREVIEW_REQUIRED');
 await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
 const required=['narration.txt','production.json','asset-plan.json','visual-grammar-plan.json','.authoring/character-assembly-plan.json','.authoring/visual-intent.json','.authoring/director-plan.json','.authoring/scene-art-direction.json','.authoring/scene-composition-resolved.json','.authoring/story-object-plan.json','.authoring/story-object-qc.json','.authoring/story-object-composition-qc.json','.authoring/pipeline-state.json','.authoring/phase02-activation-receipt.json','.authoring/phase02-visual_compile-commit.json','.authoring/phase02-assets-commit.json','.authoring/phase02-publish_prep-commit.json','.authoring/director-v2-review-receipt.json','.authoring/preview-pairs','assets','publish'];
 for(const rel of required)if(!(await copyIf(root,out,rel)))throw Error('REVIEW_REQUIRED_FILE_MISSING '+rel);
 for(const rel of ['.authoring/phase02-validator-receipts-2.4.68','.authoring/phase02-compiler-logs-2.4.68','asset-lineage-receipt.json'])await copyIf(root,out,rel);
 const design=await readFile(path.join(root,'design.md'),'utf8');const token=activeStyle(design);
 await writeFile(path.join(out,'ACTIVE-STYLE-TOKEN.json'),JSON.stringify({format:'zodiac-active-style-snapshot@1',token,source:{path:'design.md',sha256:sha(design)}},null,2)+'\n');
 const readme=`# Song Tử / Gemini — Phase 2 Visual Review\n\nPlugin: ${state.plugin_version}\nPhase: 02-visual-production\nStatus: IN_REVIEW\nScene coverage: ${report.scene_count}/${report.scene_count} complete scenes + ${report.event_pairs} event endpoint pairs.\n\nOpen .authoring/preview-pairs/index.html first. This is a diagnostic review directory, not Job@5 and not a production ZIP. No historical Phase 01 draft README or migration prose is copied into this review surface.\n`;
 await writeFile(path.join(out,'README.md'),readme);
 const inventory=[];for(const rel of (await files(out)).sort()){if(rel==='SHA256-MANIFEST.json')continue;const b=await readFile(path.join(out,rel));inventory.push({path:rel,sha256:sha(b),size:b.length});}
 await writeFile(path.join(out,'SHA256-MANIFEST.json'),JSON.stringify({format:'zodiac-phase02-review-package@2',plugin_version:state.plugin_version,phase_status:phase.status,scene_count:report.scene_count,event_pairs:report.event_pairs,files:inventory},null,2)+'\n');
 return {status:'PHASE02_REVIEW_PACKAGE_READY',files:inventory.length,scene_count:report.scene_count,event_pairs:report.event_pairs,out};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const [root,out]=process.argv.slice(2);if(!root||!out){console.error('Usage: node prepare-phase02-review.mjs <workspace> <out-dir>');process.exit(2)}preparePhase02Review(root,out).then(x=>console.log(JSON.stringify(x))).catch(e=>{console.error(e.message);process.exitCode=2});}
