import test from 'node:test';
import assert from 'node:assert/strict';
import {runNativeCommand,runNativeCommandSync} from '../native-command.mjs';

test('sync and parallel commands retain all structured issues before truncating logs',async()=>{
 const args=['-e',`console.log(JSON.stringify({issues:[{code:'FIRST',scene_id:'S01',detail:'x'.repeat(12000)},{code:'LAST',scene_id:'S19'}]}));process.exitCode=1`];
 for(const result of [runNativeCommandSync(args),await runNativeCommand(args)]){
  assert.equal(result.status,'FAIL');assert.equal(result.exit_code,1);
  assert.deepEqual(result.issues.map(i=>i.code),['FIRST','LAST']);assert.ok(result.stdout.length<=4500);
 }
});

test('native stdout cannot turn an unsuccessful process into PASS',async()=>{
 const result=await runNativeCommand(['-e',`console.log('PASS');process.exitCode=2`]);
 assert.equal(result.status,'FAIL');assert.equal(result.exit_code,2);
});

test('a hung native command times out and missing commands return a failure',async()=>{
 const result=await runNativeCommand(['-e','setInterval(()=>{},1000)'],{timeoutMs:150});
 assert.equal(result.status,'FAIL');assert.equal(result.exit_code,124);assert.ok(result.elapsed_ms<10000);
 for(const result of [runNativeCommandSync(['missing-file.mjs']),await runNativeCommand(['missing-file.mjs'])])assert.equal(result.status,'FAIL');
});

test('both runners preserve a real native PASS',async()=>{
 const args=['-e',`console.log(JSON.stringify({status:'PASS'}))`];
 for(const result of [runNativeCommandSync(args),await runNativeCommand(args)]){assert.equal(result.status,'PASS');assert.deepEqual(result.issues,[]);}
});

test('parallel output preserves Vietnamese across chunk boundaries and fails closed on output overflow',async()=>{
 const unicode=await runNativeCommand(['-e',`const b=Buffer.from(JSON.stringify({issues:[{code:'UNICODE',detail:'Tử'}]}));const x=b.indexOf(Buffer.from('ử'));process.stdout.write(b.subarray(0,x+1));setTimeout(()=>{process.stdout.write(b.subarray(x+1));process.exitCode=1},20)`]);
 assert.equal(unicode.issues[0].detail,'Tử');
 const overflow=await runNativeCommand(['-e',`process.stdout.write('x'.repeat(5*1024*1024))`]);
 assert.equal(overflow.status,'FAIL');assert.ok(overflow.issues.some(i=>i.code==='NATIVE_OUTPUT_LIMIT_EXCEEDED'));
});
