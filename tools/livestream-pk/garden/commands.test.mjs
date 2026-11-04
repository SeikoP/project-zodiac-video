import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand, resolveMention, createLimiter } from './commands.mjs';
import { makeCtx, addUser } from './testkit.mjs';

test('parseCommand maps each verb, ignoring case and accents', () => {
  assert.deepEqual(parseCommand('Trồng rau'), { cmd: 'plant', arg: 'rau', mention: null });
  assert.equal(parseCommand('trong huong duong').arg, 'huongduong');
  assert.deepEqual(parseCommand('trồng'), { cmd: 'plant', arg: null, mention: null });
  assert.equal(parseCommand('tưới').cmd, 'water');
  assert.deepEqual(parseCommand('tưới @Lan'), { cmd: 'water', arg: null, mention: 'lan' });
  assert.equal(parseCommand('bắt sâu').cmd, 'pest');
  assert.equal(parseCommand('hái').cmd, 'harvest');
  assert.equal(parseCommand('trộm').cmd, 'steal');
  assert.equal(parseCommand('trộm @Mai').mention, 'mai');
  assert.equal(parseCommand('bắt trộm').cmd, 'catch');
  assert.equal(parseCommand('thả chó').cmd, 'dog');
  assert.equal(parseCommand('vườn').cmd, 'card');
});

test('ordinary chatter and long comments are not commands', () => {
  assert.equal(parseCommand('hay quá'), null);
  assert.equal(parseCommand('tưới ' + 'x'.repeat(80)), null);
  assert.equal(parseCommand(''), null);
});

test('resolveMention matches a unique name prefix of a seated player, never an ambiguous or own name', () => {
  const { ctx } = makeCtx();
  const a = addUser(ctx, 'a').user, b = addUser(ctx, 'b').user, c = addUser(ctx, 'c').user;
  a.nickname = 'Lan An'; b.nickname = 'Lan Anh'; c.nickname = 'Mai Đào';
  assert.equal(resolveMention(ctx.state, 'lan', 'c'), null, 'two Lans');
  assert.equal(resolveMention(ctx.state, 'lan anh', 'c'), b);
  assert.equal(resolveMention(ctx.state, 'mai dao', 'a'), c);
  assert.equal(resolveMention(ctx.state, 'mai', 'c'), null, 'your own name');
  assert.equal(resolveMention(ctx.state, 'nobody', 'a'), null);
});

test('limiter allows once per window per user and key', () => {
  let t = 0;
  const l = createLimiter(() => t);
  assert.equal(l.allow('a', 'care', 1500), true);
  assert.equal(l.allow('a', 'care', 1500), false);
  assert.equal(l.allow('a', 'steal', 20000), true);
  assert.equal(l.allow('b', 'care', 1500), true);
  t = 1500;
  assert.equal(l.allow('a', 'care', 1500), true);
});
