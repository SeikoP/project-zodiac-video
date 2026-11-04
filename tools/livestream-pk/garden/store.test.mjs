import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadState, createSaver, pruneUsers } from './store.mjs';
import { makeCtx, addUser } from './testkit.mjs';

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'garden-')), 'garden-state.json');

test('a saved garden loads back with growing crops, thefts and users intact', async () => {
  const file = tmp();
  const k = makeCtx();
  const a = addUser(k.ctx, 'a', { gold: 5 });
  a.plot.crop = { type: 'rau', progress: 0.4, ripeAt: null, pest: false, stolen: 0 };
  k.ctx.state.thefts.push({ id: 1, thief: 'a', victim: 'a', plotId: a.plot.id, amount: 2, at: 1 });
  const saver = createSaver({ file, getState: () => k.ctx.state });
  await saver.flush();
  saver.stop();
  const back = loadState(file);
  assert.equal(back.plots[a.plot.id].crop.progress, 0.4);
  assert.equal(back.users.a.gold, 5);
  assert.equal(back.thefts.length, 1);
});

test('a missing file gives an empty garden', () => {
  const s = loadState(tmp());
  assert.deepEqual([s.v, Object.keys(s.users).length, s.thefts], [1, 0, []]);
});

test('a corrupt or truncated file gives an empty garden instead of crashing', () => {
  const file = tmp();
  fs.writeFileSync(file, '{"v":1,"users":{"a":');
  assert.equal(Object.keys(loadState(file).users).length, 0);
  fs.writeFileSync(file, '[1,2,3]');
  assert.equal(loadState(file).v, 1);
});

test('a file missing fields is patched with defaults', () => {
  const file = tmp();
  fs.writeFileSync(file, JSON.stringify({ v: 1, users: { a: { userId: 'a' } } }));
  const s = loadState(file);
  assert.deepEqual([Array.isArray(s.thefts), typeof s.plots, typeof s.ver, typeof s.night], [true, 'object', 'number', 'string']);
  assert.equal(s.users.a.userId, 'a');
});

test('two flushes at once leave a valid file and no temp file behind', async () => {
  const file = tmp();
  const k = makeCtx();
  addUser(k.ctx, 'a');
  const saver = createSaver({ file, getState: () => k.ctx.state });
  await Promise.all([saver.flush(), saver.flush(), saver.flush()]);
  saver.stop();
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).users.a.userId, 'a');
  assert.equal(fs.existsSync(`${file}.tmp`), false);
});

test('a failed write keeps the garden dirty so the next flush retries', async () => {
  const file = tmp();
  let fail = true;
  const fsStub = { ...fs.promises, writeFile: async (...a) => { if (fail) throw new Error('disk full'); return fs.promises.writeFile(...a); }, mkdir: fs.promises.mkdir, rename: fs.promises.rename };
  const saver = createSaver({ file, getState: () => ({ v: 1 }), fs: fsStub, log: () => {} });
  await saver.flush();
  assert.equal(saver.dirty(), true);
  fail = false;
  await saver.flush();
  assert.equal(saver.dirty(), false);
  saver.stop();
});

test('pruneUsers drops one-time visitors after 7 days but keeps anyone who harvested', () => {
  const k = makeCtx();
  const visitor = addUser(k.ctx, 'visitor'), farmer = addUser(k.ctx, 'farmer');
  farmer.user.stats.harvest = 1;
  k.advance(8 * 86_400_000);
  pruneUsers(k.ctx.state, k.ctx.now());
  assert.equal(k.ctx.state.users.visitor, undefined);
  assert.equal(k.ctx.state.plots[visitor.plot.id].owner, null, 'their plot is free again');
  assert.ok(k.ctx.state.users.farmer);
});
