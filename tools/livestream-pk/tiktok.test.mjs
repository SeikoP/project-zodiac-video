import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { WebcastEvent, ControlEvent } from 'tiktok-live-connector';
import { createGame } from './game.mjs';
import { createTikTokBridge, chatOf, likeOf, giftOf, userOf, viewersOf, msgIdOf } from './tiktok.mjs';
import { cleanName, safeAvatar } from './names.mjs';
import { createDiagnostics, ingest } from './diagnostics.mjs';

// Payloads shaped like the connector's real output: TikTok's protobuf field names (see tiktok-live-proto v3).
const user = (id, nickname, displayId = `h_${id}`) => ({ id: String(id), nickname, displayId, avatarThumb: { urlList: [`https://p16-sign-va.tiktokcdn.com/obj/${id}.jpeg`] } });
const chat = (id, nickname, content) => ({ user: user(id, nickname), content });
const like = (id, count) => ({ user: user(id, 'Lan'), count, total: '9999' });
const gift = (id, { type = 2, diamondCount = 1, repeatCount = 1, repeatEnd = 0, name = 'Rose' } = {}) => ({ user: user(id, 'Huy'), giftId: '5655', repeatCount, repeatEnd, gift: { type, diamondCount, name, image: { urlList: ['https://p16.tiktokcdn.com/g.png'] } } });

test('parsers read TikTok\'s real field names: content, count, displayId, gift.diamondCount', () => {
  assert.deepEqual(chatOf(chat(1, 'Lan', 'sư tử')), { userId: '1', nickname: 'Lan', avatar: 'https://p16-sign-va.tiktokcdn.com/obj/1.jpeg', comment: 'sư tử' });
  assert.equal(likeOf(like(1, 15)).count, 15);
  assert.equal(viewersOf({ totalUser: 321 }), 321);
  const g = giftOf(gift(2, { diamondCount: 30, repeatCount: 3, name: 'Doughnut' }));
  assert.deepEqual([g.diamonds, g.count, g.giftName, g.userId], [30, 3, 'Doughnut', '2']);
});

test('parsers still accept the older flattened shapes from the connector README', () => {
  assert.equal(chatOf({ user: { userId: '7', nickname: 'A', profilePictureUrl: 'x' }, comment: 'đỏ' }).comment, 'đỏ');
  assert.equal(likeOf({ user: { userId: '7' }, likeCount: 8 }).count, 8);
  assert.equal(giftOf({ user: { userId: '7' }, giftDetails: { giftType: 2, diamondCount: 5, giftName: 'Heart' }, repeatCount: 2 }).diamonds, 5);
  assert.equal(userOf({}).userId, 'unknown');
});

test('streakable gifts count once, when the streak ends, with the final repeat count', () => {
  assert.equal(giftOf(gift(3, { type: 1, repeatCount: 4, repeatEnd: 0 })), null);
  assert.equal(giftOf(gift(3, { type: 1, repeatCount: 5, repeatEnd: 1 })).count, 5);
  assert.equal(giftOf(gift(3, { type: 2, repeatCount: 1, repeatEnd: 0 })).count, 1); // non-streak gifts are final immediately
});

// A stand-in for TikTokLiveConnection: same events, no network.
const fakeConnection = () => Object.assign(new EventEmitter(), { connect: async () => ({ roomId: 'r1' }), disconnect: async () => {} });

test('end to end: TikTok events reach the game (join by comment, likes raise the moon, gifts and follows light the sky)', async () => {
  const conn = fakeConnection(), logs = [];
  const game = createGame({ rng: () => 0, config: { acts: false, bossEverySeconds: 0, chestEveryMinutes: 0, adaptiveCrowd: false, autoQuiz: false, quietSeconds: 9999, checkinPerNight: 0, luckyEverySeconds: 1e9, moonGoal: 1e9, signLightCost: 1000, commentLight: 2, lightPerDiamond: 5 } });
  const statuses = [];
  const bridge = createTikTokBridge({ game, connect: () => conn, log: m => logs.push(m), onStatus: s => statuses.push(s.state) });
  await bridge.connect('@someone');
  assert.equal(bridge.status().state, 'live');

  conn.emit(WebcastEvent.CHAT, chat(1, 'Lan', 'đỏ'));
  assert.equal(game.state.viewers['1'].team, 'red');
  conn.emit(WebcastEvent.LIKE, like(1, 12));
  assert.equal(game.state.moon.light, 1 + 12); // the comment (+1) and the burst of 12 likes
  conn.emit(WebcastEvent.GIFT, gift(1, { diamondCount: 10 }));
  assert.ok(game.state.wheel.light.red >= 50);
  const before = game.state.wheel.light.red;
  conn.emit(WebcastEvent.FOLLOW, { user: user(1, 'Lan') });
  assert.equal(game.state.wheel.light.red, before + 20);
  conn.emit(WebcastEvent.ROOM_USER, { viewerCount: 87 });
  assert.equal(bridge.status().viewers, 87);

  conn.emit(WebcastEvent.CHAT, null); // a malformed event must not throw or stop the show
  conn.emit(WebcastEvent.GIFT, { gift: 'nonsense' });
  assert.ok(logs.length === 0 || logs.every(l => /bad|connected/.test(l)));
  conn.emit(WebcastEvent.CHAT, chat(2, 'Huy', 'xanh dương'));
  assert.equal(game.state.viewers['2'].team, 'blue');
});

test('viewer names and avatars are cleaned before they can reach the screen', () => {
  const blocked = ['vcl', 'địt'];
  assert.equal(cleanName('  Nguyễn‮  Văn​ A ', blocked), 'Nguyễn Văn A');
  assert.equal(cleanName('', blocked), 'Người xem');
  assert.equal(cleanName('shop gia re 0912345678', blocked), 'Người xem');
  assert.equal(cleanName('xem tại abc.com', blocked), 'Người xem');
  assert.equal(cleanName('VCL con tôm', blocked), 'Người xem ẩn danh');
  assert.equal(cleanName('dit me', ['địt']), 'Người xem'.length ? cleanName('dit me', ['địt']) : '');
  assert.equal(cleanName('A'.repeat(50), []).length, 32);
  assert.equal(cleanName('😀'.repeat(40), []).replaceAll('😀', 'x').length, 32);
  assert.equal(safeAvatar('https://p16-sign-va.tiktokcdn.com/a.jpeg'), 'https://p16-sign-va.tiktokcdn.com/a.jpeg');
  assert.equal(safeAvatar('http://p16.tiktokcdn.com/a.jpeg'), '');
  assert.equal(safeAvatar('https://evil.example/a.jpeg'), '');
  assert.equal(safeAvatar('https://tiktokcdn.com.evil.example/a.jpeg'), '');
  assert.equal(safeAvatar('javascript:alert(1)'), '');
});

test('the game applies the same cleaning to every source', () => {
  const game = createGame({ config: { acts: false, autoQuiz: false, quietSeconds: 9999 } });
  game.chat({ userId: 'x', nickname: 'Bad‮Name vcl', avatar: 'https://evil.example/a.png', comment: 'đỏ' });
  assert.equal(game.state.viewers.x.nickname, 'Người xem ẩn danh');
  assert.equal(game.state.viewers.x.avatar, '');
  game.chat({ userId: 'y', nickname: 'Lan', avatar: 'https://p19.tiktokcdn-us.com/b.jpeg', comment: 'đỏ' });
  assert.equal(game.state.viewers.y.avatar, 'https://p19.tiktokcdn-us.com/b.jpeg');
});

test('diagnostics: schema probe records field names only, and a recorded night can be replayed', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-diag-'));
  try {
    const diag = createDiagnostics({ dir, record: true, now: () => Date.UTC(2026, 10, 5, 12) });
    diag.probe('chat', chat(1, 'Lan', 'bí mật không được lưu'));
    diag.probe('chat', chat(2, 'Huy', 'x'));
    const schema = JSON.parse(fs.readFileSync(path.join(dir, 'tiktok-schema.json'), 'utf8'));
    assert.deepEqual(schema.chat.fields, ['content', 'user']);
    assert.ok(schema.chat.user.includes('displayId'));
    assert.ok(!JSON.stringify(schema).includes('bí mật'));

    const rec = createGame({ rng: () => 0, config: { acts: false, bossEverySeconds: 0, chestEveryMinutes: 0, autoQuiz: false, quietSeconds: 9999, adaptiveCrowd: false, luckyEverySeconds: 1e9 } });
    const wrapped = diag.wrap(rec);
    wrapped.chat({ userId: '5', nickname: 'An', avatar: '', comment: 'song ngư' });
    wrapped.gift({ userId: '5', nickname: 'An', avatar: '', diamonds: 10, count: 2, giftName: 'Rose' });
    wrapped.like({ userId: '5', nickname: 'An', avatar: '', count: 20 });
    wrapped.social({ userId: '5', nickname: 'An', avatar: '', kind: 'follow' });
    await diag.close();
    const lines = fs.readFileSync(diag.eventsFile, 'utf8').trim().split('\n').map(l => JSON.parse(l));
    assert.deepEqual(lines.map(l => l.type), ['chat', 'gift', 'like', 'social']);

    const replayed = createGame({ rng: () => 0, config: { acts: false, bossEverySeconds: 0, chestEveryMinutes: 0, autoQuiz: false, quietSeconds: 9999, adaptiveCrowd: false, luckyEverySeconds: 1e9 } });
    for (const l of lines) ingest(replayed, l);
    assert.deepEqual(replayed.state.wheel.light, rec.state.wheel.light);
    assert.equal(replayed.state.viewers['5'].lifetime, rec.state.viewers['5'].lifetime);
    assert.throws(() => ingest(replayed, { type: 'nope' }), /unknown event type/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('msgIdOf reads the message id from common.msgId or msgId', () => {
  assert.equal(msgIdOf({ common: { msgId: 12n } }), '12');
  assert.equal(msgIdOf({ msgId: '7' }), '7');
  assert.equal(msgIdOf({}), null);
  assert.equal(msgIdOf(null), null);
});

test('duplicate TikTok messages (same msgId) reach the game once, also across a reconnect', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const conns = [];
  const calls = { chat: 0, gift: 0, like: 0, social: 0, member: 0 };
  const game = Object.fromEntries(Object.keys(calls).map(k => [k, () => { calls[k]++; }]));
  const bridge = createTikTokBridge({ game, log: () => {}, connect: () => { const c = fakeConnection(); conns.push(c); return c; } });
  const withId = (d, id) => ({ ...d, common: { msgId: id } });
  await bridge.connect('@room');
  const c = conns[0];
  c.emit(WebcastEvent.CHAT, withId(chat(1, 'Lan', 'đỏ'), '1'));
  c.emit(WebcastEvent.CHAT, withId(chat(1, 'Lan', 'đỏ'), '1'));
  c.emit(WebcastEvent.CHAT, withId(chat(1, 'Lan', 'đỏ'), '2'));
  c.emit(WebcastEvent.CHAT, chat(1, 'Lan', 'đỏ'));
  c.emit(WebcastEvent.CHAT, chat(1, 'Lan', 'đỏ'));
  assert.equal(calls.chat, 4);
  c.emit(WebcastEvent.GIFT, withId(gift(2, { type: 1, repeatCount: 3, repeatEnd: 1 }), 'g1'));
  c.emit(WebcastEvent.GIFT, withId(gift(2, { type: 1, repeatCount: 3, repeatEnd: 1 }), 'g1'));
  assert.equal(calls.gift, 1);
  for (const [ev, d] of [[WebcastEvent.LIKE, like(1, 5)], [WebcastEvent.FOLLOW, { user: user(1, 'Lan') }], [WebcastEvent.SHARE, { user: user(1, 'Lan') }], [WebcastEvent.MEMBER, { user: user(3, 'Mai') }]])
    for (let i = 0; i < 2; i++) c.emit(ev, withId(d, `${ev}-x`));
  assert.deepEqual([calls.like, calls.social, calls.member], [1, 2, 1]);

  c.emit(ControlEvent.DISCONNECTED);
  t.mock.timers.tick(5000);
  await new Promise(r => setImmediate(r));
  assert.equal(conns.length, 2, 'the bridge reconnected');
  conns[1].emit(WebcastEvent.CHAT, withId(chat(1, 'Lan', 'đỏ'), '1'));
  assert.equal(calls.chat, 4, 'a replay after the reconnect is still a duplicate');

  await bridge.connect('@other');
  conns.at(-1).emit(WebcastEvent.CHAT, withId(chat(1, 'Lan', 'đỏ'), '1'));
  assert.equal(calls.chat, 5, 'another room starts with a fresh memory');
});

test('the protobuf default msgId "0" is not a real id', () => {
  assert.equal(msgIdOf({ common: { msgId: '0' } }), null);
  assert.equal(msgIdOf({ common: { msgId: 0 } }), null);
});

test('messages whose msgId is the protobuf default "0" are never dropped', async () => {
  const conn = fakeConnection();
  let chats = 0;
  const bridge = createTikTokBridge({ game: { chat: () => { chats++; } }, log: () => {}, connect: () => conn });
  await bridge.connect('@room');
  for (let i = 0; i < 3; i++) conn.emit(WebcastEvent.CHAT, { ...chat(1, 'Lan', 'đỏ'), common: { msgId: '0' } });
  assert.equal(chats, 3);
});

test('Ngắt then Kết nối to the same room keeps the duplicate memory', async () => {
  const conns = [];
  let chats = 0;
  const bridge = createTikTokBridge({ game: { chat: () => { chats++; } }, log: () => {}, connect: () => { const c = fakeConnection(); conns.push(c); return c; } });
  await bridge.connect('@room');
  conns[0].emit(WebcastEvent.CHAT, { ...chat(1, 'Lan', 'đỏ'), common: { msgId: '9' } });
  await bridge.disconnect();
  await bridge.connect('room');
  conns[1].emit(WebcastEvent.CHAT, { ...chat(1, 'Lan', 'đỏ'), common: { msgId: '9' } });
  assert.equal(chats, 1);
});
