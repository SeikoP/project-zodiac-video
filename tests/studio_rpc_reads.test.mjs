import test from 'node:test';
import assert from 'node:assert/strict';
import { shareRead } from '../apps/zodiac-studio/src/rpc-reads.ts';

test('concurrent equal reads share work and completed reads are never cached', async () => {
 let calls=0, finish;
 const work=()=>{calls++;return new Promise(resolve=>{finish=resolve;});};
 const first=shareRead('voice.open',{project_id:'p'},work);
 const second=shareRead('voice.open',{project_id:'p'},work);
 assert.equal(calls,1); finish('ok');
 assert.deepEqual(await Promise.all([first,second]),['ok','ok']);
 await shareRead('voice.open',{project_id:'p'},async()=>{calls++;return 'new';});
 assert.equal(calls,2);
});

test('writes and distinct project reads never share', async () => {
 let calls=0;
 const work=async()=>++calls;
 await Promise.all([shareRead('voice.start',{},work),shareRead('voice.start',{},work),
  shareRead('pipeline.get',{project_id:'a'},work),shareRead('pipeline.get',{project_id:'b'},work)]);
 assert.equal(calls,4);
});

test('failed reads release their slot so retry can recover', async () => {
 await assert.rejects(shareRead('pipeline.get',{},async()=>{throw new Error('offline');}),/offline/);
 assert.equal(await shareRead('pipeline.get',{},async()=>42),42);
});
