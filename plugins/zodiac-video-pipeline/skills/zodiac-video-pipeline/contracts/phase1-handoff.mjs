import {createHash} from 'node:crypto';

export const PHASE1_HANDOFF_FORMAT='zodiac-phase1-handoff@2';
export const PHASE1_HANDOFF_MAJOR=2;
export const PHASE1_HANDOFF_FORMAT_V1='zodiac-phase1-handoff@1';
export const PHASE1_HANDOFF_MAJOR_V1=1;

export const PHASE1_HANDOFF_REQUIRED_V1=[
  'narration.txt','narrative-plan.json','episode-scope.json','writer-brief.json',
  'pipeline-state.json','content-review-receipt.json','plugin-use-decisions.json'
];

export const PHASE1_HANDOFF_REQUIRED=[
  'narration.txt','narrative-plan.json','episode-scope.json','writer-brief.json',
  'voice-profile.json','content-review-receipt.json'
];

export const sha256=data=>createHash('sha256').update(data).digest('hex');

export function requiredForHandoff(manifest){
  return manifest?.contract_major===PHASE1_HANDOFF_MAJOR_V1?PHASE1_HANDOFF_REQUIRED_V1:PHASE1_HANDOFF_REQUIRED;
}

export function buildInventory(entries){
  return [...entries].map(entry=>({path:entry.rel,sha256:sha256(entry.data),size:entry.data.length}))
    .sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}

export function formatSha256Sums(inventory){
  return inventory.map(x=>`${x.sha256}  ${x.path}`).join('\n')+'\n';
}

export function validateHandoffManifest(manifest){
  const v1=manifest?.format===PHASE1_HANDOFF_FORMAT_V1&&manifest?.contract_major===PHASE1_HANDOFF_MAJOR_V1;
  const v2=manifest?.format===PHASE1_HANDOFF_FORMAT&&manifest?.contract_major===PHASE1_HANDOFF_MAJOR;
  if(!v1&&!v2)throw Error('PHASE1_HANDOFF_FORMAT_UNSUPPORTED');
  if(typeof manifest.run_id!=='string'||!manifest.run_id.trim())throw Error('PHASE1_HANDOFF_RUN_ID_INVALID');
  if(typeof manifest.plugin_version!=='string'||!manifest.plugin_version.trim())throw Error('PHASE1_HANDOFF_PLUGIN_VERSION_INVALID');
  const review=manifest.content_review;
  if(review?.status!=='APPROVED'||review?.proof?.kind!=='user_message'||!review?.proof?.ref?.trim())throw Error('PHASE1_HANDOFF_APPROVAL_INVALID');
  if(v2&&typeof review?.proof?.text!=='string')throw Error('PHASE1_HANDOFF_APPROVAL_TEXT_REQUIRED');
  if(!Array.isArray(manifest.inventory)||!manifest.inventory.length)throw Error('PHASE1_HANDOFF_INVENTORY_INVALID');
  return manifest;
}
