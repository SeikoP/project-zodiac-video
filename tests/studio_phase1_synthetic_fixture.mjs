#!/usr/bin/env node
// Isolated synthetic test fixture ONLY. Does not assert a real user approved anything.
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {exportPhase1Handoff} from '../plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/phases/phase01/export-phase1-handoff.mjs';
import {parsePortableZip,buildPortableZip} from '../plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/core/portable/zip-primitives.mjs';
import {buildInventory,formatSha256Sums} from '../plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/contracts/phase1-handoff.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function create(output,mode='valid'){
 const root=await mkdtemp(path.join(tmpdir(),'zodiac-p0-test-only-'));
 try{
  await mkdir(path.join(root,'.authoring'));
  const source={
   narration:Buffer.from('Câu duyệt giả lập riêng cho unit test.\n','utf8'),
   plan:Buffer.from(JSON.stringify({format:'zodiac-narrative-plan@1',sign:'Song Tu',story_spine:{premise:'preview'}})),
   scope:Buffer.from(JSON.stringify({episode_id:'studio-test-only',sign:'Song Tu',concept:'fixture'})),
   brief:Buffer.from(JSON.stringify({creative_direction:{tone:'normal'}})),
   voice:Buffer.from(JSON.stringify({format:'zodiac-voice-profile@1',narrator_vibe:'normal sharp'}))
  };
  const files={narration:'narration.txt',plan:'.authoring/narrative-plan.json',
   scope:'.authoring/episode-scope.json',brief:'.authoring/phase3-writer-brief.json',
   voice:'.authoring/voice-profile.json'};
  for(const [k,p]of Object.entries(files))await writeFile(path.join(root,p),source[k]);
  const hashes=Object.fromEntries(Object.entries(source).map(([k,v])=>[k,sha(v)]));
  const review={format:'zodiac-content-review@2',phase_id:'01-content',status:'APPROVED',
   run_id:'studio-test-only',proof:{kind:'user_message',
    ref:'SYNTHETIC-TEST-FIXTURE-NOT-PRODUCTION',text:'Synthetic test approval'},source_hashes:hashes};
  await writeFile(path.join(root,'.authoring/content-review-receipt.json'),JSON.stringify(review));
  await exportPhase1Handoff(root,output);
  if(mode==='valid')return;
  const entries=parsePortableZip(await readFile(output));
  let manifest=JSON.parse(entries.find(e=>e.rel==='HANDOFF.json').data);
  if(mode==='drift')entries.find(e=>e.rel==='narration.txt').data=Buffer.from('Changed after synthetic approval\n');
  if(mode==='missing-approval')manifest.content_review.status='PENDING';
  if(mode==='proof-mismatch')manifest.content_review.proof.ref='mismatched synthetic message';
  if(mode==='receipt-mismatch'){
   const receipt=JSON.parse(entries.find(e=>e.rel==='content-review-receipt.json').data);
   receipt.proof.ref='different-source-test-only';
   entries.find(e=>e.rel==='content-review-receipt.json').data=Buffer.from(JSON.stringify(receipt));
  }
  if(mode==='invalid-zip'){await writeFile(output,Buffer.from('Not a ZIP'));return;}
  const payload=entries.filter(x=>!['HANDOFF.json','SHA256SUMS'].includes(x.rel));
  const inventory=buildInventory(payload);
  manifest.inventory=inventory;
  await writeFile(output,buildPortableZip([
   {rel:'HANDOFF.json',data:Buffer.from(JSON.stringify(manifest))},
   ...payload.map(({rel,data})=>({rel,data})),
   {rel:'SHA256SUMS',data:Buffer.from(formatSha256Sums(inventory))}
  ]));
 }finally{await rm(root,{recursive:true,force:true});}
}
const [out,mode]=process.argv.slice(2);
if(!out)throw Error('out required');
create(out,mode).catch(error=>{console.error(error);process.exitCode=1;});
