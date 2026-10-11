import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';

const validator=resolve(import.meta.dirname,'..','validate-story-spine-performance.mjs');
const raw='Nhân Mã rủ thử lối mới trước khi đến lớp. Cả nhóm nhìn lên biển rồi tăng tốc ngay. Một bức tường xuất hiện chặn bước cả nhóm. Nhân Mã chọn cửa kính rồi thấy cửa giao hàng khóa. Bạn báo còn một phút nên Nhân Mã dẫn nhóm quay về. Vào lớp rồi Nhân Mã vẫn rủ mai thử đường khác.';
const excerpts=[
 'Nhân Mã rủ thử lối mới trước khi đến lớp',
 'Cả nhóm nhìn lên biển rồi tăng tốc ngay',
 'Một bức tường xuất hiện chặn bước cả nhóm',
 'Nhân Mã chọn cửa kính rồi thấy cửa giao hàng khóa',
 'Bạn báo còn một phút nên Nhân Mã dẫn nhóm quay về',
 'Vào lớp rồi Nhân Mã vẫn rủ mai thử đường khác',
];
const hash=txt=>createHash('sha256').update(txt).digest('hex');
const plan={story_spine:{identity_tension:'want to explore vs need to arrive',starting_read:'looks reckless',progression_intent:'attempt then retreat',payoff_target:'still curious'},beats:excerpts.map((_,i)=>({id:'B'+(i+1)}))};
const planRaw=JSON.stringify(plan);
function makeAudit(){return {
 format:'zodiac-story-spine-performance@1',
 source:{plan_sha256:hash(planRaw),narration_sha256:hash(raw)},
 decision:'PASS',revision_targets:[],
 spine:Object.fromEntries(Object.keys(plan.story_spine).map((k,i)=>[k,{assessment:'PASS',reason:'Specific authored narration reflects this axis',evidence_excerpt:excerpts[i]}])),
 beats:excerpts.map((line,i)=>({beat_id:'B'+(i+1),assessment:'PASS',evidence_excerpt:line,character_action:'Makes a choice with an observable action',response_or_state_change:'Another participant or obstacle changes the situation',semantic_delta_realized:'A new narrative state is created',spine_effect:'A different interpretation is possible',review_note:'Examined after writing; this is editorial QC, not automated semantic scoring'}))
};}
async function run(modify=()=>{},altNarration=raw,altPlan=planRaw){
 const dir=await mkdtemp(join(tmpdir(),'zodiac-spine-test-'));
 try{const audit=makeAudit();modify(audit);await writeFile(join(dir,'audit.json'),JSON.stringify(audit));await writeFile(join(dir,'plan.json'),altPlan);await writeFile(join(dir,'narration.txt'),altNarration);
 return spawnSync(process.execPath,[validator,join(dir,'plan.json'),join(dir,'narration.txt'),join(dir,'audit.json')],{encoding:'utf8'});
 }finally{await rm(dir,{recursive:true,force:true});}
}
test('all four spine anchors and six ordered beats PASS when quotes are grounded',async()=>{const r=await run();assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/STORY_SPINE_PERFORMANCE_PASS: anchors=4 beats=6/);});
test('missing beat cannot pass',async()=>{const r=await run(a=>a.beats.pop());assert.notEqual(r.status,0);assert.match(r.stderr,/STORY_SPINE_BEAT_COVERAGE/);});
test('missing narration quote cannot pass',async()=>{const r=await run(a=>a.beats[2].evidence_excerpt='Nhân Mã bỗng bay lên trời rất cao');assert.notEqual(r.status,0);assert.match(r.stderr,/STORY_SPINE_QUOTE_NOT_FOUND/);});
test('source edits invalidate stale semantic review',async()=>{const r=await run(()=>{},raw+' thêm một câu');assert.notEqual(r.status,0);assert.match(r.stderr,/STORY_SPINE_SOURCE_DRIFT/);});
test('reordered beats cannot pass',async()=>{const r=await run(a=>{[a.beats[0],a.beats[1]]=[a.beats[1],a.beats[0]];});assert.notEqual(r.status,0);assert.match(r.stderr,/STORY_SPINE_BEAT_ORDER/);});
test('a reviewed-but-unfixed beat blocks Content Review',async()=>{const r=await run(a=>{a.beats[4].assessment='REVIEW';a.decision='REVIEW';a.revision_targets=['Ensure character chooses to return'];});assert.notEqual(r.status,0);assert.match(r.stderr,/STORY_SPINE_REVIEW_REQUIRED/);});
test('quoted beat progression must follow narration order',async()=>{const r=await run(a=>{a.beats[1].evidence_excerpt=excerpts[0];});assert.notEqual(r.status,0);assert.match(r.stderr,/STORY_SPINE_BEAT_ORDER/);});
