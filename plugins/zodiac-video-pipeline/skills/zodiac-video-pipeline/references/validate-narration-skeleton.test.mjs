import assert from 'node:assert/strict';
import test from 'node:test';
import {checkSkeleton} from './validate-narration-skeleton.mjs';

const P=[
 'Song Tử im lặng không phải vì hết chuyện. Họ đang chấm điểm bạn.',
 'Bạn kể một chuyện, Song Tử hỏi mười câu liền. Nhìn như tò mò, nhưng thật ra họ đang ghép bức tranh xem lời bạn có khớp nhau không. Câu nào lệch, họ nhớ.',
 'Bạn hứa một câu cho có, họ không cãi. Họ chỉ ngừng kể cho bạn nghe chuyện của họ, thế nhưng bạn thì cứ tưởng mọi thứ vẫn ổn.',
 'Khi giận, Song Tử cười rất duyên. Nhưng tin nhắn của họ ngắn dần, trả lời chậm dần. Đến khi bạn nhận ra, mình đã ra khỏi vòng trong rồi.',
 'Song Tử không lạnh lùng. Họ chỉ không phí sức vào người chưa chứng minh được sự thật thà.',
 'Nên lần sau Song Tử im lặng, đừng hỏi họ giận không. Hãy hỏi mình đã chấm điểm đúng chưa.'
];
const join=a=>a.join('\n\n');
const codes=r=>r.issues.map(i=>i.code);
const swap=(i,v)=>P.map((p,k)=>k===i?v:p);

test('a script that follows the six-paragraph skeleton passes',()=>{
 const r=checkSkeleton(join(P));
 assert.equal(r.status,'PASS',JSON.stringify(r.issues));
 assert.equal(r.paragraphs,6);
});
test('wrong paragraph count stops at the slot check',()=>{
 const r=checkSkeleton(join(P.slice(0,5)));
 assert.deepEqual(codes(r),['SLOT_COUNT']);
});
test('a long hook is flagged',()=>{
 const r=checkSkeleton(join(swap(0,'Hôm nay mình muốn nói với các bạn một điều rất quan trọng về Song Tử im lặng.')));
 assert.ok(codes(r).includes('HOOK_LONG'));
 assert.ok(codes(r).includes('FILLER'));
});
test('a facet without a surface-versus-inside contrast is flagged',()=>{
 const r=checkSkeleton(join(swap(2,'Bạn hứa một câu cho có, họ không cãi. Họ chỉ ngừng kể cho bạn nghe chuyện của họ, và bạn thì cứ tưởng mọi thứ vẫn ổn thôi.')));
 assert.deepEqual(codes(r),['FACET_NO_CONTRAST']);
});
test('an ending that does not return to the hook is flagged',()=>{
 const r=checkSkeleton(join(swap(5,'Nên lần sau gặp một người như vậy, hãy nhớ kiên nhẫn một chút nhé.')));
 assert.ok(codes(r).includes('CLOSE_NO_CALLBACK'));
});
test('a call to action in the ending is flagged',()=>{
 const r=checkSkeleton(join(swap(5,'Nên lần sau Song Tử im lặng, hãy theo dõi để xem phần sau chấm điểm.')));
 assert.ok(codes(r).includes('CLOSE_CTA'));
});
test('a sentence that cannot be said in one breath is flagged',()=>{
 const long='Bạn hứa một câu cho có và họ không cãi mà cũng chẳng nhắc lại chuyện cũ nữa nhưng họ lặng lẽ ngừng kể chuyện của họ cho bạn nghe từ hôm đó trở đi.';
 const r=checkSkeleton(join(swap(2,long)));
 assert.ok(codes(r).includes('SENTENCE_LONG'));
});
test('a long open-ended story script is not mistaken for a skeleton script',()=>{
 const story=Array.from({length:20},(_,i)=>'Đoạn '+i+' kể thêm một chuyện nữa.').join('\n\n');
 assert.deepEqual(codes(checkSkeleton(story)),['SLOT_COUNT']);
});

import {checkSituation} from './validate-narration-skeleton.mjs';
const M=[
 'Cô vừa giao đề, Sư Tử đã giơ tay: “Để tớ làm nhóm trưởng.” Không ai kịp nói gì, mà cũng chẳng ai định giành.',
 'Họp nhóm lần đầu, Sư Tử chia việc rất công bằng. Mỗi bạn một mục nhỏ. Còn phần mở đầu và phần kết, họ nhận hết.',
 'Ba ngày sau cả nhóm nộp slide. Sư Tử xem từng trang và bảo ổn đấy. Rồi lặng lẽ đổi font, đổi màu, đổi cả thứ tự.',
 'Một bạn góp ý phần mở đầu hơi dài. Sư Tử cười và bảo ý hay đấy. Nhưng cả buổi họp sau, họ không hỏi bạn ấy thêm câu nào.',
 'Đêm trước thuyết trình, một giờ sáng, Sư Tử nhắn nhóm: mọi người ngủ đi, để tớ lo nốt. Sáng ra, slide dài thêm sáu trang.',
 'Đến giờ thuyết trình, Sư Tử bước lên đầu tiên. Giọng to, tay chỉ thẳng vào màn hình, mắt nhìn cả lớp như đang đứng trên sân khấu.',
 'Cô hỏi một câu khó, cả lớp im phăng phắc. Miệng Sư Tử vẫn cười, nhưng mắt đã quay sang nhóm: ai đó cứu tớ với.',
 'Bạn nhỏ nhất nhóm đứng lên trả lời đúng. Sư Tử vỗ tay to hơn cả lớp. Tối đó họ nhắn riêng: câu trả lời hay thật, tớ sẽ nhớ mãi.'
];
const SIT=[
 'Khi Sư Tử làm nhóm trưởng, bài thuyết trình có đúng một ngôi sao.',
 ...M,
 'Sư Tử không muốn một mình đứng giữa sân khấu. Họ muốn có ai đó nhìn xuống và nói: nhờ có cậu.',
 'Điểm chín về cả nhóm. Ngôi sao duy nhất chỉ hỏi nhỏ: các bạn có thấy tớ thức đến một giờ sáng không?'
];
const sit=a=>checkSituation(a.join('\n\n'));
test('situation: one sign through one situation, with a returning close, passes',()=>{const r=sit(SIT);assert.equal(r.status,'PASS',JSON.stringify(r.issues));assert.equal(r.mode,'situation');});
test('situation: too few moments stops at the slot check',()=>{assert.deepEqual(codes(sit(SIT.slice(0,5))),['SLOT_COUNT']);});
test('situation: moments that open alike read as a list',()=>{const a=[...SIT];a[3]='Họp nhóm lần đầu, Sư Tử kể thêm một chuyện nữa về bài thuyết trình của cả nhóm. Mọi người lại im lặng nghe.';assert.ok(codes(sit(a)).includes('MOMENT_SAME_OPENING'));});
test('situation: no moment where outside and inside disagree is flagged',()=>{const a=SIT.map(p=>p.replace('Nhưng','Và').replace('nhưng','và').replace('mà cũng','và cũng'));assert.ok(codes(sit(a)).includes('TOO_FEW_CONTRASTS'));});
test('situation: an ending that forgets the opening image is flagged',()=>{const a=[...SIT];a[a.length-1]='Điểm chín về cả nhóm và mọi người rủ nhau đi ăn tối thật vui vẻ.';assert.ok(codes(sit(a)).includes('CLOSE_NO_CALLBACK'));});
test('situation: a short sketch is rejected as too short in total',()=>{const a=[SIT[0],...M.slice(0,6).map(p=>p.split('.')[0]+'. Rồi ai nấy về.'),SIT.at(-2),SIT.at(-1)];assert.ok(codes(sit(a)).includes('TOTAL_SIZE')||codes(sit(a)).includes('MOMENT_SIZE'));});
