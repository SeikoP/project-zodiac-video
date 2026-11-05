import test from 'node:test';
import assert from 'node:assert/strict';
import {planPluginUse,validatePluginUse} from '../plan-plugin-use.mjs';
import {planNotionSync,validateNotionSyncReceipt} from '../../core/integrations/notion-sync.mjs';

test('HumanWriting is optional narration guidance and cannot replace Zodiac meaning or approval',()=>{
 const r=planPluginUse({
  phase:'01-content',
  weaknesses:[{kind:'natural_voice',excerpt:'Đoạn này nghe quá công thức và đều nhịp.'}],
  availableSkills:[{id:'human-writing',uri:'skills://plugins/humanwriting/human-writing/skill.md'}]
 });
 assert.equal(r.decisions[0].skill_id,'human-writing');
 assert.equal(r.decisions[0].status,'REQUESTED');
 assert.equal(r.decisions[0].preserve_semantics,true);
 assert.equal(r.replaces_zodiac,false);
 const applied={...r,decisions:r.decisions.map(x=>({...x,status:'APPLIED',skill_read_ref:'skill-read:humanwriting',application_summary:'Chỉnh nhịp câu và từ ngữ, giữ nguyên claim, fact và payoff.'}))};
 assert.equal(validatePluginUse(applied).not_an_approval,true);
});

test('HumanWriting absence falls back to native review without blocking',()=>{
 const r=planPluginUse({phase:'01-content',weaknesses:[{kind:'formulaic_language',excerpt:'Cấu trúc lặp và có dấu hiệu văn mẫu.'}],availableSkills:[]});
 assert.equal(r.decisions[0].skill_id,'human-writing');
 assert.equal(r.decisions[0].status,'NATIVE_REVIEW');
});

test('Notion sync is a one-way knowledge sink and never becomes evidence or approval',()=>{
 const plan=planNotionSync({
  phase:'02-visual-production',step:'visual_compile',status:'IN_REVIEW',
  artifacts:[{path:'.authoring/visual-intent.json',sha256:'a'.repeat(64)}],
  blockers:['Visual Review pending'],
  decisions:[{summary:'Narrative Visuals remain episode-authored'}]
 });
 assert.equal(plan.pipeline_state_authoritative,true);
 assert.equal(plan.notion_can_create_approval,false);
 assert.equal(plan.notion_can_create_episode_evidence,false);
 assert.equal(plan.direction,'zodiac_to_notion');
 const receipt={...plan,format:'zodiac-notion-sync-receipt@1',notion_page_ref:'notion:page:123',synced_at:'2026-11-05T13:30:00Z',not_an_approval:true,not_evidence:true};
 assert.equal(validateNotionSyncReceipt(receipt).status,'VALID');
});

test('Notion receipt fails closed if it claims approval or evidence authority',()=>{
 const base={...planNotionSync({phase:'03-handoff',step:'export',status:'PASS'}),format:'zodiac-notion-sync-receipt@1',notion_page_ref:'notion:page:123',synced_at:'2026-11-05T13:30:00Z',not_an_approval:false,not_evidence:true};
 assert.throws(()=>validateNotionSyncReceipt(base),/NOTION_SYNC_AUTHORITY_VIOLATION/);
});
