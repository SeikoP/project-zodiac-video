import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildIdeaPrompt, statusFor, signState, conceptById} from '../apps/zodiac-studio/src/idea-board.ts';

const catalog=JSON.parse(await readFile(new URL('../tools/studio_project/idea_catalog.json',import.meta.url),'utf8'));
const concept=catalog.groups[0].concepts[0];
test('copied prompt explicitly delegates Phase 1 to the Web plugin and its current skill',()=>{
 const prompt=buildIdeaPrompt({...catalog,progress:[]},concept);
 assert.ok(prompt.startsWith('Dùng plugin @Zodiac-Video-Web (Zodiac Video Web)'));
 assert.ok(prompt.includes('zodiac-video-web:zodiac-video-web'));
 assert.ok(prompt.includes('SKILL.md')&&prompt.includes('references'));
 assert.ok(prompt.includes('không truy cập được')&&prompt.includes('không tự thay bằng workflow chung'));
 assert.ok(prompt.includes('Evidence → Voice → Concept → Narrative Design → Narration → Content Review'));
 assert.ok(prompt.includes('Recognition & Identity Gate')&&prompt.includes('dual editorial read'));
 assert.ok(prompt.includes('Narrative Plan 2.1')&&prompt.includes('voice_anchor'));
 assert.ok(prompt.includes('Chỉ sau khi tôi duyệt Content Review'));
 assert.ok(prompt.includes('zodiac-phase1-handoff@2')&&prompt.includes('không chạy Phase 2'));
 assert.ok(!prompt.includes('workflow Zodiac hiện hành'));
});
test('agent chooses among untouched signs, with completed and ongoing work explicit',()=>{
 const board={...catalog,progress:[
  {concept_id:concept.id,sign:catalog.signs[0],status:'mp4_approved'},
  {concept_id:concept.id,sign:catalog.signs[1],status:'in_progress'},
  {concept_id:'other',sign:catalog.signs[2],status:'mp4_approved'}
 ]};
 const original=JSON.stringify(board);
 const prompt=buildIdeaPrompt(board,concept);
 assert.ok(prompt.includes(concept.title)&&prompt.includes(concept.direction));
 assert.ok(prompt.includes('MP4 đã duyệt: Bạch Dương'));
 assert.ok(prompt.includes('Đang làm: Kim Ngưu'));
 assert.ok(prompt.includes('Cung được chọn: '+catalog.signs.slice(2).join(', ')));
 assert.ok(prompt.includes('Tự chọn đúng 1 cung')&&prompt.includes('Content Review'));
 assert.ok(prompt.includes(concept.id));
 assert.equal(JSON.stringify(board),original);
 assert.equal(statusFor(board,concept.id,catalog.signs[2]),'not_started');
});
test('all approved blocks duplicates and unfinished fallback remains explicit',()=>{
 const board={...catalog,progress:catalog.signs.map(sign=>({concept_id:concept.id,sign,status:'mp4_approved'}))};
 assert.equal(buildIdeaPrompt(board,concept),null);
 board.progress[0].status='in_progress';
 assert.ok(buildIdeaPrompt(board,concept).includes('Cung được chọn: Bạch Dương'));
 assert.ok(buildIdeaPrompt(board,concept).includes('tiếp tục phần còn thiếu'));
});

test('a chosen sign is fixed in the prompt and an approved sign cannot be requested again',()=>{
 const board={...catalog,progress:[{concept_id:concept.id,sign:'Nhân Mã',status:'mp4_approved',updated_at:1}]};
 const text=buildIdeaPrompt(board,concept,'Bạch Dương');
 assert.ok(text.includes('Cung được chọn: Bạch Dương (đã chốt, không đổi cung).'));
 assert.ok(!text.includes('Tự chọn đúng 1 cung'));
 assert.equal(buildIdeaPrompt(board,concept,'Nhân Mã'),null);
});

test('an imported episode marks its sign as started, but never as approved',()=>{
 const board={...catalog,progress:[]};
 assert.equal(signState(board,concept.id,'Nhân Mã',true),'in_progress');
 assert.equal(signState(board,concept.id,'Nhân Mã',false),'not_started');
 const approved={...catalog,progress:[{concept_id:concept.id,sign:'Nhân Mã',status:'mp4_approved',updated_at:1}]};
 assert.equal(signState(approved,concept.id,'Nhân Mã',true),'mp4_approved');
});

test('the concept code in a handoff resolves to a catalog title',()=>{
 const found=conceptById({...catalog,progress:[]},'love-sincere');
 assert.equal(found?.title,'Khi một cung hoàng đạo thật lòng yêu');
 assert.equal(conceptById({...catalog,progress:[]},'does-not-exist'),undefined);
 assert.equal(conceptById(null,'love-sincere'),undefined);
});
