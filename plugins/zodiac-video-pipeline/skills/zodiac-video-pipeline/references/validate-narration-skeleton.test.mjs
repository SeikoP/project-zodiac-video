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

import {checkLongProfile} from './validate-narration-skeleton.mjs';
const LONG=[
 "Ba điều khiến Sư Tử gạch tên bạn mà không nói một lời. Phạm cả ba thì bạn hết cứu.",
 "Thứ nhất, đừng khen Sư Tử cho có. Họ có một cái ăng-ten riêng để bắt lời nịnh. Bạn khen áo đẹp mà mắt còn dán vào điện thoại, họ nghe ra ngay. Sư Tử không ghét lời khen. Họ ghét lời khen không có người ở trong.",
 "Thứ hai, đừng cướp sân khấu của họ giữa chừng. Sư Tử đang kể dở mà bạn chen vào kể chuyện hay hơn, họ vẫn cười, vẫn gật. Nhưng trong cuốn sổ của họ, bạn vừa bị ghi một dòng đỏ.",
 "Thứ ba, đừng chê Sư Tử trước mặt người khác. Một câu góp ý giữa đám đông nặng hơn mười câu nói riêng. Họ sẽ cười và bảo ý hay đấy. Rồi nhớ đúng câu đó thêm ba tháng nữa. Còn nếu bạn chê đúng, họ sẽ về nhà sửa thật. Nhưng đừng chê ở chỗ có khán giả.",
 "Bề ngoài, Sư Tử là người dẫn đầu. Đặt bàn trước, chốt quán trước, nói to nhất nhóm. Nhìn tưởng độc đoán. Nhưng thật ra họ đang đứng đó chờ một cái gật đầu. Chưa ai gật, họ hỏi lại lần hai, lần ba, giọng vẫn vui. Cái vẻ tự tin ấy giống một sân khấu dựng sẵn. Đèn sáng, nhạc to, và họ tìm đúng một gương mặt ở hàng ghế dưới đang nhìn mình. Chỉ cần ai đó giơ ngón cái lên là họ sáng cả buổi.",
 "Khi đã thất vọng, Sư Tử không làm ầm. Đó mới là chỗ đáng sợ. Họ vẫn chào, vẫn cười xã giao, nhưng bạn thử rủ đi ăn xem. Câu trả lời sẽ là: dạo này mình bận. Bạn nhắn xin lỗi, họ thả tim. Đúng một cái tim, không chữ nào. Ba lần bận liền là bạn đã bị mời ra khỏi vòng trong. Còn lý do thì chẳng ai kể, vì với Sư Tử, giải thích tức là xin được hiểu, mà họ không xin.",
 "Ban ngày Sư Tử dẫn cả nhóm. Nhưng nửa đêm, họ nằm nhớ lại buổi sáng: lúc mình nói có ai cười chưa, chuyện mình kể có nhạt không. Người dẫn đầu cả ngày hóa ra cũng cần ai đó xác nhận là mình ổn. Họ sẽ không bao giờ nhắn: tôi cần bạn. Họ chỉ nhắn: đang làm gì đấy? Họ lướt lại tin nhắn cũ, đếm xem ai đã trả lời mình nhanh nhất. Rồi ngồi chờ.",
 "Nhưng nếu bạn qua được bài kiểm tra, Sư Tử sẽ đối xử với bạn như người quan trọng nhất đời họ. Bao cả bàn không chớp mắt. Nhớ sinh nhật bạn, nhớ cả món bạn kiêng. Bạn khóc là họ bỏ hết mọi việc ngồi nghe. Bạn nói muốn học nghề mới, họ gửi luôn ba khóa học và một lời hứa sẽ ngồi học cùng. Cái hào phóng ấy không phải để khoe. Đó là cách họ nói: tôi quý bạn, và tôi muốn bạn thấy điều đó.",
 "Chỉ có một điều họ xin lại: hãy thấy công của họ. Quên cảm ơn một câu, họ ghi sổ đến lần gặp sau. Họ không tính tiền. Họ tính xem bạn có nhìn thấy không.",
 "Nên ba điều kia thực ra chỉ là một. Đừng làm Sư Tử thấy mình vô hình. Làm được, bạn không bị gạch tên. Bạn nằm ở cuốn sổ còn lại, cuốn dành cho người họ nhớ lâu."
];
const lng=a=>checkLongProfile(a.join('\n\n'));
test('long profile: dealbreakers, outer, dark, night, warm, turn and a returning close pass',()=>{const r=lng(LONG);assert.equal(r.status,'PASS',JSON.stringify(r.issues));assert.equal(r.mode,'long-profile');});
test('long profile: a different paragraph count stops at the slot check',()=>{assert.deepEqual(codes(lng(LONG.slice(0,7))),['SLOT_COUNT']);});
test('long profile: a dealbreaker that drops its ordinal breaks the promised number',()=>{const a=[...LONG];a[2]=a[2].replace('Thứ hai, ','Và rồi ');assert.ok(codes(lng(a)).includes('DEALBREAKER_ORDINAL'));});
test('long profile: a script cut to the six-paragraph length is too short in total',()=>{const a=LONG.map(p=>p.split('. ').slice(0,2).join('. ')+'.');assert.ok(codes(lng(a)).includes('TOTAL_SIZE'));});
test('long profile: an ending that forgets the hook is flagged',()=>{const a=[...LONG];a[9]='Nên hãy nhớ kiên nhẫn một chút với người bạn yêu quý, vì ai cũng có lúc cần được lắng nghe thật lòng.';assert.ok(codes(lng(a)).includes('CLOSE_NO_CALLBACK'));});
test('long profile: no outside-versus-inside marker in the outer section is flagged',()=>{const a=[...LONG];a[4]=a[4].replace('Nhưng thật ra','Và');assert.ok(codes(lng(a)).includes('FACET_NO_CONTRAST'));});
