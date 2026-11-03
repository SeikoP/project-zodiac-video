import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './game.mjs';
import { ROASTS } from './roast.mjs';

const sky = () => ({ planets: [], moon: { full: false }, mercuryRetro: false });
function setup() {
  let t = 1_000_000;
  const events = [];
  const game = createGame({ config: { hours: false, bossEverySeconds: 0, chaosEverySeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false, quietSeconds: 9999, luckyEverySeconds: 1e6 }, now: () => t, rng: () => 0, readSky: sky, onEvent: e => events.push(e) });
  const say = (id, comment) => game.chat({ userId: id, nickname: id, comment });
  const advance = ms => { t += ms; game.tick(); };
  return { game, events, say, advance, of: type => events.filter(e => e.type === type) };
}

test('every sign has its own roasts', () => {
  assert.equal(Object.keys(ROASTS).length, 12);
  for (const lines of Object.values(ROASTS)) assert.ok(lines.length >= 5);
});

test('the wheel lands on a sign with fans here; enough "oan" clears its name and pays the protesters', () => {
  const s = setup();
  s.say('a', 'Sư Tử'); s.say('b', 'Sư Tử'); s.say('c', 'Bảo Bình');
  const r = s.game.startRoast('leo');
  assert.equal(r.sign, 'leo');
  assert.equal(s.of('roast-start')[0].need, 1);
  s.say('a', 'oan quá'); // still spinning: doesn't count yet
  assert.equal(s.game.snapshot().cosmos.roast.protests, 0);
  s.advance(6000);
  const before = s.game.state.viewers.a.lifetime;
  s.say('a', 'oan quá');
  s.say('c', 'chuẩn luôn');
  s.say('c', 'oan'); // only the roasted sign's fans can protest
  assert.equal(s.game.snapshot().cosmos.roast.protests, 1);
  s.advance(20_000);
  const end = s.of('roast-end')[0];
  assert.equal(end.cleared, true);
  assert.ok(s.game.state.viewers.a.lifetime > before);
});

test('an unanswered roast stands, and the sign gets the lucky star as consolation', () => {
  const s = setup();
  s.say('a', 'Song Ngư');
  s.game.startRoast('pisces');
  s.advance(26_000);
  const end = s.of('roast-end')[0];
  assert.equal(end.cleared, false);
  assert.equal(end.consoled, true);
  assert.equal(s.game.state.lucky.sign, 'pisces');
});
