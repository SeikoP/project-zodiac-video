# Livestream PK — Sim Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehearsal (`sim:`) events can never change the real LIVE game, duplicate TikTok events count once, and crowd-scaled goals rise with the room.

**Architecture:** Remove the `sim/*` API from the main server and drop `sim:` users at the game's five entry points unless `cfg.rehearsal`; delete the now-dead purge code. Add a rotating msgId memory to the TikTok bridge and a ratcheting goal retune to `tick()`. Fix predict's no-winner refund and rounding.

**Tech Stack:** Node ESM (`.mjs`), `node --test`, `tiktok-live-connector@2.5.0`. All paths below are relative to `tools/livestream-pk/`.

**Spec:** `docs/superpowers/specs/2026-11-04-livestream-sim-isolation-design.md`

## Global Constraints

- Do not touch `obs/`, `Mo-OBS.bat`, `scripts/setup-obs.mjs`, OBS notes in README (project CLAUDE.md).
- Do not change `scripts/simulator.mjs` or `public/simulator/`.
- New config keys and defaults: `rehearsal: false`, `crowdRetuneSeconds: 30`, `crowdRetuneStep: 1.25`.
- Dedup memory: two rotating `Set`s, rotate when the current one exceeds 5000 ids; id = `d?.common?.msgId ?? d?.msgId` as a string.
- Run the full suite with `npm test` from `tools/livestream-pk/`; it must stay green after every task.

## Review Focus

- A `sim:` gift arriving while a boss, tug or run is active must leave HP, rope position and enemy HP untouched → covered by the isolation test in Task 1 (start all three, gift, deep-equal).
- A real viewer whose id happens to contain `sim` but does not start with `sim:` must still play → Task 1 test `real ids containing "sim" are not dropped`.
- After a reconnect the connector replays the last few messages → Task 3 test keeps memory across `open()`.
- Goal retune with an empty stage (0 viewers) must not lower or NaN the goal → Task 4 test with stage emptied.
- predict with stake > 0 where winners have 0 dust (staked 0) but losers staked → total paid ≤ pot + bonuses → Task 5 test.

---

### Task 1: Drop `sim:` users in the game unless rehearsing; remove purge

**Files:**
- Modify: `game.mjs` (`DEFAULT_CONFIG` ~line 61; state normalisation ~line 312; `member` 401, `chat` 929, `gift` 1079, `like` 1102, `social` 1119; delete `purgeSim` 1440-1458 and from the return object 1460)
- Modify: `boss.mjs:162-163`, `run.mjs:413-414`, `roast.mjs:70-71`, `tug.mjs:75-76`, `predict.mjs:69-70` — delete `purge` and remove it from each return object
- Test: `game.test.mjs` (replace the `purgeSim removes rehearsal viewers…` test at line 324)

**Interfaces:**
- Produces: `cfg.rehearsal: boolean` (default `false`); `game.purgeSim` no longer exists; module objects no longer expose `purge`.

- [ ] **Step 1: Write failing tests in `game.test.mjs`** (build the game the way `mechanics.test.mjs` `setup()` does: fixed clock, `rng: () => 0`, quiet sky, auto events off)

```js
test('outside rehearsal, sim: viewers change nothing, even mid boss/tug/run', () => {
  // real viewers a,b (Sư Tử), c,d (Bảo Bình) join; startBoss(), then after it ends startTug(), then startRun() —
  // whichever order the guards allow; at minimum one of them must be active when the snapshot is taken.
  const before = structuredClone(game.state); const n = events.length;
  for (const id of ['sim:x', 'sim:y']) {
    game.member({ userId: id, nickname: id });
    for (const c of ['Sư Tử', '12/8', 'ước thi đỗ', 'nhận', 'chúc', 'đánh nó', 'kéo!', 'đoán A', 'nâng cấp', 'kho', 'bingo'])
      game.chat({ userId: id, nickname: id, comment: c });
    game.gift({ userId: id, nickname: id, diamonds: 1000, count: 3, giftName: 'Galaxy' });
    game.like({ userId: id, nickname: id, count: 500 });
    game.social({ userId: id, nickname: id, kind: 'follow' });
    game.social({ userId: id, nickname: id, kind: 'share' });
  }
  assert.deepEqual(game.state, before);
  assert.equal(events.length, n);
});
test('rehearsal mode still plays sim: viewers', () => { /* config rehearsal: true; chat sim:x 'Sư Tử' → state.viewers['sim:x'].sign === 'leo' */ });
test('real ids containing "sim" are not dropped', () => { /* chat userId 'simon' 'Sư Tử' → viewer exists with sign 'leo' */ });
test('a saved state with leftover sim: viewers loads without them', () => { /* state from emptyState() with viewers['sim:old'] and viewers['real']; createGame rehearsal false → only 'real' remains */ });
```

- [ ] **Step 2: Run** `node --test game.test.mjs` — expected: the first and fourth tests FAIL.

- [ ] **Step 3: Implement.** Add `rehearsal: false` to `DEFAULT_CONFIG` with a one-line comment. Add `const rehearsalOnly = u => !cfg.rehearsal && String(u?.userId ?? '').startsWith('sim:');` near the top of `createGame`, and return early from `member`, `chat`, `gift`, `like`, `social` when it is true (`member` returns `false`). In the state normalisation block, when `!cfg.rehearsal`, delete `st.viewers` keys starting with `sim:`. Delete `purgeSim` and every module `purge`; delete the old purge test.

- [ ] **Step 4: Run** `npm test` — expected: all PASS. (If any other test relied on `sim:` ids, give it `rehearsal: true`.)

- [ ] **Step 5: Commit** `feat(livestream): ignore rehearsal viewers outside the simulator; drop purgeSim`

### Task 2: Main server serves no rehearsal API

**Files:**
- Modify: `server.mjs` (createGame config ~line 44; `meta()` ~line 50; `API` sim routes 192-203; remove `game.purgeSim()` at 188 and 316)
- Modify: `public/control.html` (rehearsal block and handlers 233-240)
- Modify: `README.md` (rehearsal-on-control-panel and purge wording only; not OBS notes)
- Test: `simulator.test.mjs`

**Interfaces:**
- Consumes: `cfg.rehearsal` from Task 1.
- Produces: `meta().simulator: boolean`.

- [ ] **Step 1: Write failing test** in `simulator.test.mjs`: `main server has no rehearsal API` — start `server.mjs` like the existing isolated test but **without** `PK_SIMULATOR` (keep `PK_NO_TIKTOK=1`, temp data/log dirs, free ports); wait for `GET /` 200; assert `POST /api/sim/chat` status `404` and `POST /api/sim/crowd` status `404`. In the existing isolated test add: `POST /api/sim/chat {user:'fan1', comment:'Sư Tử'}` → status `200`.

- [ ] **Step 2: Run** `node --test simulator.test.mjs` — expected: new test FAILS (sim/chat returns 200).

- [ ] **Step 3: Implement.** `const SIMULATOR = process.env.PK_SIMULATOR === '1';` Pass `rehearsal: SIMULATOR` into `createGame` config (after `...saved` so settings cannot override it). Move the seven `sim/*` entries out of the `API` literal into `if (SIMULATOR) Object.assign(API, { … })`, and stop `sim/storm`'s interval only there. Remove both `game.purgeSim()` calls (keep `tiktok.connect`). Add `simulator: SIMULATOR` to `meta()`. In `control.html`, wrap the rehearsal controls in one element hidden unless `meta.simulator`, with the line `Diễn tập: chạy npm run simulator` shown otherwise. Update README accordingly.

- [ ] **Step 4: Run** `npm test` — expected: all PASS.

- [ ] **Step 5: Verify in browser** — start `npm start` with `PK_NO_TIKTOK=1`, open `http://127.0.0.1:4848/control`: rehearsal buttons are hidden and the hint line shows. Stop the server.

- [ ] **Step 6: Commit** `feat(livestream): rehearsal API only in the isolated simulator`

### Task 3: Deduplicate TikTok events by msgId

**Files:**
- Modify: `tiktok.mjs` (`createTikTokBridge`, handlers ~lines 80-87, `connect`)
- Test: `tiktok.test.mjs`

**Interfaces:**
- Produces: exported `msgIdOf(d): string | null`.

- [ ] **Step 1: Confirm the field.** Check a recorded `logs/events-*.jsonl` (or add a temporary `probe` print in a scratch script against a recorded payload) for where the connector puts the message id. If it is not `common.msgId` or `msgId`, use the real path in `msgIdOf` and record it in the spec's section 4.

- [ ] **Step 2: Write failing tests** in `tiktok.test.mjs` using the existing fake-connection pattern:
  - `msgIdOf` reads `{ common: { msgId: 12n } }` → `'12'`, `{ msgId: '7' }` → `'7'`, `{}` → `null`.
  - same chat payload with `common.msgId: '1'` emitted twice → game.chat called once.
  - different msgIds → twice; no msgId → twice.
  - gift with `repeatEnd: 1` and a msgId emitted twice → game.gift once.
  - emit msgId `'1'`, trigger DISCONNECTED and let the retry `open()` run (inject a short delay or call through), emit `'1'` again on the new connection → still once.
  - `connect('other')` then msgId `'1'` → counted again.

- [ ] **Step 3: Run** `node --test tiktok.test.mjs` — expected: new tests FAIL.

- [ ] **Step 4: Implement** `msgIdOf` and a `seen(d)` closure in the bridge (two Sets, rotate past 5000; ids without msgId never seen). Guard chat, member, gift (after `giftOf` returns non-null), like, follow, share. Clear both Sets in `connect()` when the username differs from the previous `wanted`.

- [ ] **Step 5: Run** `npm test` — expected: all PASS.

- [ ] **Step 6: Commit** `fix(livestream): ignore duplicate TikTok events after a reconnect`

### Task 4: Crowd-scaled goals rise with the room, never fall

**Files:**
- Modify: `game.mjs` (`DEFAULT_CONFIG` near `adaptiveCrowd` ~line 110; `tick()` ~line 1221)
- Test: `game.test.mjs`

**Interfaces:**
- Consumes: existing `wheelCost(no)`, `moonGoalFor(full)`, `touch(...)`.

- [ ] **Step 1: Write failing test** `crowd goals ratchet up by at most 25% per retune and never fall`: setup with `adaptiveCrowd: true`; 2 viewers join; record `w0 = state.wheel.cost`, `m0 = state.moon.goal`; 20 more viewers join; `advance(30_000)` → `wheel.cost === Math.min(fullWheel, Math.ceil(w0 * 1.25))` where `fullWheel` is the cost computed with crowdFactor 1 (`cfg.constellationCost` for wheel no 1); keep advancing in 30 s steps until it stops changing → equals `fullWheel`; same for moon with `Math.max(60, …)`. Then remove viewers from stage (advance past the stage idle window or use `pruneViewers`) and advance 30 s → values unchanged. Also: `advance(10_000)` right after a retune changes nothing; no `moon-full` / `wheel-complete` event is emitted by retunes; with `crowdRetuneSeconds: 0` nothing changes.

- [ ] **Step 2: Run** `node --test game.test.mjs` — expected: FAIL.

- [ ] **Step 3: Implement** `crowdRetuneSeconds: 30, crowdRetuneStep: 1.25` in `DEFAULT_CONFIG` and a `retuneGoals(t)` called from `tick()`: skip unless `cfg.adaptiveCrowd && cfg.crowdRetuneSeconds`, and only once per `crowdRetuneSeconds` (closure-local `lastRetuneAt`); for each of wheel/moon, if target > current set `min(target, ceil(current * crowdRetuneStep))`; `touch('hud', 'cosmos')` when anything changed.

- [ ] **Step 4: Run** `npm test` — expected: all PASS.

- [ ] **Step 5: Commit** `feat(livestream): crowd-scaled goals follow a growing room`

### Task 5: predict refunds when nobody is right; bingo coverage

**Files:**
- Modify: `predict.mjs` (`resolve`)
- Test: `mechanics.test.mjs`

- [ ] **Step 1: Write failing tests** in `mechanics.test.mjs` (use its `setup()`; open a prediction via `s.game.state` helpers the existing predict test uses, or `startTug`):
  - `predict: with a stake and no right guess, everyone gets the stake back` — `predictStake: 5`; give a,b 20 dust; both guess A; resolve B → each back to 20.
  - `predict: payouts never exceed the pot plus bonuses` — `predictStake: 5`; a has 0 dust and guesses A, b and c have 20 and guess B; resolve A → sum of dust gained across all three ≤ `pot + predictBonus * 1`.
  - `predict: several right guessers each get the bonus; a second guess is ignored; a guess after closing is ignored; a viewer removed before resolve is skipped without error`.
  - `bingo: one event completes a line for several viewers at once` — two viewers with cards sharing a line; emit the events that complete it → two `bingo` events and one gem each.
  - `bingo: the same event twice adds nothing` and `bingo: a viewer who left the stage is not marked`.

- [ ] **Step 2: Run** `node --test mechanics.test.mjs` — expected: the no-right-guess refund and payout-cap tests FAIL; the others may already pass.

- [ ] **Step 3: Implement** in `resolve`: treat `winner !== null && right.length === 0` like `winner === null` for payouts (event still reports the real `winner`/`answer`); use `Math.floor` for the pot share.

- [ ] **Step 4: Run** `npm test` — expected: all PASS.

- [ ] **Step 5: Commit** `fix(livestream): predictions refund when nobody guessed right`
