import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const script=fileURLToPath(new URL('../../references/narration-progressive-validation.mjs',import.meta.url));
const hash=s=>createHash('sha256').update(s).digest('hex');
const run=ws=>spawnSync(process.execPath,[script,ws,'draft'],{encoding:'utf8'});

test('long locked narration needs exact-hash documented editorial exception',async()=>{
 const ws=await mkdtemp(path.join(tmpdir(),'z-duration-')),dir=path.join(ws,'.authoring');
 try{
  await mkdir(dir);
  const narration=('Song Tử nói chuyện rất nhiều nhưng chưa có lời hứa. ').repeat(80);
  const plan={version:'2.0',selected_concept_id:'C1',sign:{id:'gemini',label:'Song Tử'},beats:[{id:'B1'},{id:'B2'}]};
  const candidate={id:'C1',premise:'Giao tiếp chưa phải cam kết'};
  const design={
   format:'zodiac-engagement-design@1',selected_concept_id:'C1',
   source:{plan_sha256:hash(JSON.stringify(plan)),candidate_sha256:hash(JSON.stringify(candidate))},
   entry_hook:{intent:'Câu hỏi quan hệ đã xuất hiện.',mechanism:'Mâu thuẫn được nêu ngay.'},
   open_question:'Trò chuyện có đồng nghĩa cam kết?',recognition_loop:['Lời nhắn qua đêm','Người nghe kỳ vọng'],
   reframe_points:['Giao tiếp không phải cam kết'],payoff_callback:'Quay lại nghịch lý ở đầu.',
   beat_pull:[
    {beat_id:'B1',question_created:'Câu hỏi của người nghe?',reason_to_continue:'Chưa có câu trả lời rõ.',new_information:'Mối quan hệ chưa xác định.'},
    {beat_id:'B2',question_created:'Người gửi nghĩ điều gì?',reason_to_continue:'Còn cách hiểu đối lập.',new_information:'Người gửi chỉ muốn trò chuyện.'}
   ]
  };
  const files={'pipeline-state.json':{phases:{'01-content':{current_step:'narration'}}},'narrative-plan.json':plan,'concept-candidates.json':{selected_candidate_id:'C1',candidates:[candidate]},'phase3-writer-brief.json':{rhythm_direction:'Nhấn ở điểm đối lập.',narrator_vibe:['observational'],engagement_direction:{entry_hook:'Câu hỏi quan hệ đã xuất hiện.',recognition_cues:[]}},'engagement-design.json':design};
  for(const [name,data] of Object.entries(files))await writeFile(path.join(dir,name),JSON.stringify(data));
  await writeFile(path.join(dir,'narration.txt'),narration);
  const first=run(ws);
  assert.equal(first.status,2,first.stderr);
  assert.match(first.stderr,/DURATION_OVER_120/);
  const good={format:'zodiac-duration-editorial-exception@1',decision:'EDITORIAL_EXCEPTION',narration_sha256:hash(narration),reason:'Người dùng đã chốt bản lời dài này; biên tập giữ nguyên độ dài và đánh giá tăng nhịp theo diễn tiến cụ thể.',user_review_excerpt:'bỏ và chốt kịch bản'};
  await writeFile(path.join(dir,'duration-exception.json'),JSON.stringify({...good,narration_sha256:'0'.repeat(64)}));
  assert.equal(run(ws).status,2,'stale narration hash must not allow bypass');
  await writeFile(path.join(dir,'duration-exception.json'),JSON.stringify(good));
  const passed=run(ws);
  assert.equal(passed.status,0,passed.stderr);
  const report=JSON.parse(await readFile(path.join(dir,'narration-draft-checkpoint.json'),'utf8'));
  assert.equal(report.status,'PASS');
  assert.equal(report.duration_exception.not_tts_verification,true);
 }finally{await rm(ws,{recursive:true,force:true});}
});
