const allowedStatuses=new Set(['DRAFT','IN_REVIEW','APPROVED','PASS','BLOCKED']);
const allowedPhases=new Set(['01-content','02-visual-production','03-handoff']);

export function planNotionSync({phase,step,status,artifacts=[],decisions=[],blockers=[]}={}){
 if(!allowedPhases.has(phase))throw Error('NOTION_SYNC_PHASE_INVALID');
 if(typeof step!=='string'||!step.trim())throw Error('NOTION_SYNC_STEP_REQUIRED');
 if(!allowedStatuses.has(status))throw Error('NOTION_SYNC_STATUS_INVALID');
 for(const a of artifacts){if(!a?.path?.trim()||!/^([a-f0-9]{64})$/u.test(a.sha256??''))throw Error('NOTION_SYNC_ARTIFACT_INVALID');}
 for(const d of decisions){if(!d?.summary?.trim())throw Error('NOTION_SYNC_DECISION_INVALID');}
 for(const b of blockers){if(typeof b!=='string'||!b.trim())throw Error('NOTION_SYNC_BLOCKER_INVALID');}
 return {
  format:'zodiac-notion-sync-plan@1',
  phase,step,status,
  direction:'zodiac_to_notion',
  pipeline_state_authoritative:true,
  notion_can_create_approval:false,
  notion_can_create_episode_evidence:false,
  notion_can_override_artifact_hashes:false,
  artifacts:artifacts.map(x=>({path:x.path,sha256:x.sha256})),
  decisions:decisions.map(x=>({summary:x.summary})),
  blockers:[...blockers],
  allowed_content:['status','artifact_links_and_hashes','validated_decisions','blockers','PR_and_release_links'],
  forbidden_content:['approval_creation','episode_evidence_creation','pipeline_state_override','silent_requirement_changes'],
  note:'Notion is an optional knowledge/progress sink. Zodiac pipeline state, validators and genuine user review receipts remain authoritative.'
 };
}

export function validateNotionSyncReceipt(doc){
 if(doc?.format!=='zodiac-notion-sync-receipt@1')throw Error('NOTION_SYNC_RECEIPT_INVALID');
 if(doc.pipeline_state_authoritative!==true||doc.notion_can_create_approval!==false||doc.notion_can_create_episode_evidence!==false||doc.notion_can_override_artifact_hashes!==false||doc.not_an_approval!==true||doc.not_evidence!==true)throw Error('NOTION_SYNC_AUTHORITY_VIOLATION');
 if(doc.direction!=='zodiac_to_notion')throw Error('NOTION_SYNC_DIRECTION_INVALID');
 if(typeof doc.notion_page_ref!=='string'||!doc.notion_page_ref.trim())throw Error('NOTION_SYNC_PAGE_REF_REQUIRED');
 if(typeof doc.synced_at!=='string'||Number.isNaN(Date.parse(doc.synced_at)))throw Error('NOTION_SYNC_TIMESTAMP_INVALID');
 return {format:doc.format,status:'VALID',not_an_approval:true,not_evidence:true};
}
