import assert from 'node:assert/strict';
import test from 'node:test';
import {checkTrendPhrases} from './validate-trend-phrases.mjs';

const narration='Ai đó nói chuyện với bạn rất chill. Nhưng khi bị bỏ rơi thì không chill nổi.';
const item=(over={})=>({phrase:'rất chill',slot:'hook',function:'mock seriousness: deflates the claim',evidence_class:'observed',sources:[{url:'https://example.com/a',date:'2026-10-02'}],natural_check:'Short, easy to say in a casual Vietnamese voice.',...over});
const doc=(...items)=>({format:'zodiac-trend-phrases@1',items});
const codes=r=>r.issues.map(i=>i.code);

test('a bounded, sourced, spoken phrase passes',()=>{assert.equal(checkTrendPhrases(doc(item()),narration).status,'PASS');});
test('an empty list passes: a trend phrase is optional',()=>{assert.equal(checkTrendPhrases(doc(),narration).status,'PASS');});
test('a third phrase is too many',()=>{const r=checkTrendPhrases(doc(item(),item({phrase:'không chill nổi'}),item({phrase:'nói chuyện với bạn'})),narration);assert.ok(codes(r).includes('TOO_MANY'));});
test('a phrase that is not spoken is rejected',()=>{assert.ok(codes(checkTrendPhrases(doc(item({phrase:'xịn xò con bò'})),narration)).includes('NOT_IN_NARRATION'));});
test('a source without a date is rejected',()=>{assert.ok(codes(checkTrendPhrases(doc(item({sources:[{url:'https://example.com/a'}]})),narration)).includes('SOURCE_DATE'));});
test('recurring needs three independent sites',()=>{
 const two=[{url:'https://a.com/x',date:'2026-10'},{url:'https://b.com/y',date:'2026-10'},{url:'https://a.com/z',date:'2026-10'}];
 assert.ok(codes(checkTrendPhrases(doc(item({evidence_class:'recurring',sources:two})),narration)).includes('RECURRING_NEEDS_3'));
 const three=[...two.slice(0,2),{url:'https://c.com/z',date:'2026-10'}];
 assert.equal(checkTrendPhrases(doc(item({evidence_class:'recurring',sources:three})),narration).status,'PASS');
});
test('measured needs a platform and window',()=>{assert.ok(codes(checkTrendPhrases(doc(item({evidence_class:'measured'})),narration)).includes('MEASURED_NEEDS_WINDOW'));});
test('a bare slang word with no stated job is rejected',()=>{assert.ok(codes(checkTrendPhrases(doc(item({function:'slang'})),narration)).includes('FUNCTION'));});
