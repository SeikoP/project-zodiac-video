import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import os from 'node:os';import path from 'node:path';import test from 'node:test';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('./validate-story-quality-review.mjs',import.meta.url));
const hash=s=>createHash('sha256').update(s).digest('hex');
const lines=['Bảo Bình thích nói khác người, nhưng lần này đám bạn lại không chịu nghe.','Cả lớp chỉ có hai lựa chọn, Bảo Bình muốn làm cách thứ ba.','Một người đột nhiên phản đối vì bị giao phần khó nhất.','Bảo Bình tự tay xóa phương án mình vừa bảo vệ.','Không còn tranh đúng sai, cả lớp phải chia việc cho công bằng.','Lần này điều Bảo Bình đổi không phải đáp án mà là câu hỏi.'];
const keys=['premise_strength','stakes_or_recognition','progression_and_turn','sign_irreplaceability','payoff_and_callback','silent_read_test'];
async function verify(edit){const dir=await mkdtemp(path.join(os.tmpdir(),'zquality-'));try{
const d=path.join(dir,'.authoring');await mkdir(d);
const plan=JSON.stringify({selected_concept_id:'C3'}),candidate=JSON.stringify({selected_candidate_id:'C3'}),narration=lines.join(' ');
const qa={format:'zodiac-story-quality-review@1',source:{plan_sha256:hash(plan),narration_sha256:hash(narration),candidates_sha256:hash(candidate)},selected_concept_id:'C3',reviewer_role:'editorial_challenger',blind_read_verdict:'Bản nháp có lựa chọn làm thay đổi lập trường, dù chi phí của bạn trong lớp cần được soi kỹ.',criteria:Object.fromEntries(keys.map((k,i)=>[k,{result:'PASS',objection:'Phản biện riêng về mâu thuẫn và hệ quả số '+i+' chưa đủ sức thuyết phục.',response:'Đã đối chiếu hành động thực tế của nhân vật và nhận định được sự khác biệt ở đoạn '+i+'.',evidence_excerpt:lines[i]}])),decision:'PASS',revision_targets:[]};
edit?.(qa);
for(const [n,s] of [['narrative-plan.json',plan],['concept-candidates.json',candidate],['narration.txt',narration],['story-quality-review.json',JSON.stringify(qa)]])await writeFile(path.join(d,n),s);
return spawnSync(process.execPath,[script,dir],{encoding:'utf8'});
}finally{await rm(dir,{recursive:true,force:true});}}
test('grounded independent editorial artifact can pass structural integrity',async()=>{const q=await verify();assert.equal(q.status,0,q.stderr);assert.match(q.stdout,/editorial_quality_unverified/);});
test('stale narration fingerprint is rejected',async()=>{const q=await verify(x=>x.source.narration_sha256='0'.repeat(64));assert.notEqual(q.status,0);assert.match(q.stderr,/fingerprints/);});
test('unresolved critique blocks content review',async()=>{const q=await verify(x=>{x.criteria.sign_irreplaceability.result='REVIEW';});assert.notEqual(q.status,0);assert.match(q.stderr,/unresolved editorial objections/);});
test('copy-pasted generic objections are rejected',async()=>{const q=await verify(x=>{for(const k of keys)x.criteria[k].objection='Nội dung có vẻ hay nhưng chưa chắc vì thiếu yếu tố khó đoán rõ ràng.';});assert.notEqual(q.status,0);assert.match(q.stderr,/recycled generic/);});
