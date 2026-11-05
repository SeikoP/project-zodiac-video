import test from 'node:test';import assert from 'node:assert/strict';
import {analyzeRetentionStructure} from '../retention-structure.mjs';

const words=s=>s.trim().split(/\s+/u);
function fixture({late=false,long=false,gap=false}={}){
 const head=late?Array.from({length:20},(_,i)=>'mo'+i).join(' ')+' ':'';
 const body=long?Array.from({length:590},(_,i)=>'w'+i).join(' '):'Bọ Cạp thấy một chi tiết lệch nên bắt đầu nghi ngờ. Bạn hôm qua bảo ghét cà phê nhưng hôm nay lại cầm bạc xỉu. Câu hỏi là vì sao lời nói đổi nhanh như vậy. Họ im lặng đối chiếu rồi càng nghĩ chiếc ly càng thành manh mối. Nhưng suy luận không phải lúc nào cũng đúng. Cuối cùng bạn nói quán hết trà đào nên uống thử bạc xỉu.';
 const narration=head+body;
 const tokenList=words(narration);
 const pick=(start,len=5)=>tokenList.slice(start,start+len).join(' ');
 const hookStart=late?20:0;
 const beatStarts=gap?[hookStart,hookStart+5,Math.min(tokenList.length-20,hookStart+120),Math.min(tokenList.length-10,hookStart+130)]:[hookStart,hookStart+8,hookStart+18,Math.max(hookStart+28,tokenList.length-35),Math.max(hookStart+35,tokenList.length-18)];
 const review={criteria:{
  hook_strength:{result:'PASS',evidence_excerpt:pick(hookStart)},
  early_value:{result:'PASS',evidence_excerpt:pick(hookStart+6)},
  curiosity_continuity:{result:'PASS',evidence_excerpt:pick(Math.min(hookStart+12,tokenList.length-6))},
  recognition_density:{result:'PASS',evidence_excerpt:pick(Math.min(hookStart+16,tokenList.length-6))},
  reframe_strength:{result:'PASS',evidence_excerpt:pick(Math.max(0,tokenList.length-30))},
  payoff_satisfaction:{result:'PASS',evidence_excerpt:pick(Math.max(0,tokenList.length-8))}
 },pull_chain:beatStarts.map((x,i)=>({beat_id:'B'+(i+1),result:'PASS',evidence_excerpt:pick(Math.min(x,tokenList.length-6)),reason_to_continue:'new information '+i})),consecutive_explanation_risk:{result:'PASS',note:'Concrete progression is present.'},decision:'PASS',revision_targets:[]};
 const design={reframe_points:long?['one']:['one','two']};
 const plan={beats:review.pull_chain.map(x=>({id:x.beat_id}))};
 return {narration,engagementReview:review,engagementDesign:design,plan};
}
test('strong early structure passes',()=>{const r=analyzeRetentionStructure(fixture());assert.equal(r.status,'PASS');assert.equal(r.risk_level,'LOW');});
test('hook after first 16 tokens reviews',()=>{const r=analyzeRetentionStructure(fixture({late:true}));assert.equal(r.status,'REVIEW');assert.ok(r.issues.some(x=>x.code==='HOOK_LATE'));});
test('long narration with too few turns and reframes reviews',()=>{const r=analyzeRetentionStructure(fixture({long:true}));assert.equal(r.status,'REVIEW');assert.ok(r.issues.some(x=>x.code==='RUNTIME_LONG_WITH_FEW_TURNS'));assert.ok(r.issues.some(x=>x.code==='RUNTIME_LONG_WITH_FEW_REFRAMES'));});
test('large gap between pull evidence reviews',()=>{const r=analyzeRetentionStructure(fixture({gap:true}));assert.equal(r.status,'REVIEW');assert.ok(r.issues.some(x=>x.code==='PULL_GAP_LONG'));});
