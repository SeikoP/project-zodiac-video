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
