import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeContextData} from '../compile-step-capsule.mjs';

test('context remains lossless JSON if the optional TOON encoder is unavailable',async()=>{
 const value={task:{phase:'01-content',step:'evidence'},beats:['một','hai'],metadata:{approved:false}};
 const result=await encodeContextData(value,{loadToon:async()=>{throw Error('MODULE_NOT_FOUND: @toon-format/toon');}});
 assert.equal(result.format,'json');
 assert.equal(result.content,JSON.stringify(value));
 assert.deepEqual(result.decoded,value);
 assert.ok(result.tokens>0);
 assert.equal(result.json_tokens,result.tokens);
});

test('context remains JSON if an encoder roundtrip is lossy',async()=>{
 const value={nested:{exact:true},count:2};
 const result=await encodeContextData(value,{loadToon:async()=>({encode:()=>'{broken}',decode:()=>({nested:{exact:false}})})});
 assert.equal(result.format,'json');
 assert.deepEqual(result.decoded,value);
});
