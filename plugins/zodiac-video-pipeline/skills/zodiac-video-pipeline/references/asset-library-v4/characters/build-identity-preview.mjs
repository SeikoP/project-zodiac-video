import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(x).digest('hex');
const esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export async function buildCharacterIdentityPreview(plan,{outDir,compileSvg,signature}={}){
 const engine=compileSvg&&signature?{compileCharacterSvg:compileSvg,identitySignature:signature}:await import('./compile-character-assembly.mjs');
 const {compileCharacterSvg,identitySignature}=engine;
 const previews=(plan.characters??[]).map(spec=>{const state=spec.states?.[spec.initial_state]??Object.values(spec.states??{})[0];if(!state)throw Error('IDENTITY_PREVIEW_STATE_MISSING '+spec.entity_id);const compiled=compileCharacterSvg(spec,state);return {entity_id:spec.entity_id,role:spec.design_intent?.role??'legacy',identity_signature:identitySignature(spec),asset_sha256:sha(compiled.svg),svg:compiled.svg,notes:spec.visual_identity_intent?.reference_notes??spec.design_intent?.audience_read??''};});
 const html='<!doctype html><meta charset="utf-8"><title>Cast identity review</title><style>body{background:#F6F0E6;color:#2F3C44;font:16px system-ui}main{display:flex;gap:20px;flex-wrap:wrap}.canvas{width:260px;height:380px;background:#FFFDF9}.canvas svg{width:100%;height:100%}section{width:280px}p{max-width:280px}</style><h1>Cast identity — same canvas</h1><p>Review silhouette, face, hair, shirt, outfit and role. Native structural checks do not approve appearance.</p><main>'+previews.map(p=>'<section><h2>'+esc(p.entity_id)+' · '+esc(p.role)+'</h2><div class="canvas">'+p.svg+'</div><p>'+esc(p.notes)+'</p></section>').join('')+'</main>';
 const receipt={format:'zodiac-character-identity-preview@1',plan_sha256:sha(JSON.stringify(plan)),index_sha256:sha(html),canvas:{width:260,height:380},creative_status:'CREATIVE_REVIEW_REQUIRED',characters:previews.map(({svg,notes,...p})=>p)};
 if(outDir){await mkdir(outDir,{recursive:true});await writeFile(path.join(outDir,'index.html'),html);await writeFile(path.join(outDir,'identity-preview-receipt.json'),JSON.stringify(receipt,null,2)+'\n');}return {html,receipt};
}
