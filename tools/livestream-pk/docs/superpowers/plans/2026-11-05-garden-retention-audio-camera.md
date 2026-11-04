# Garden Retention, Audio and Camera Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add session competition and lasting personal titles, make the Garden control usable, reuse PK music/SFX, and improve Garden framing and presentation while keeping one listening port.

**Architecture:** Keep Garden's existing game modules and save file. Add a small competition module for session scores and lifetime honors, expose it through the existing Garden server/control flow, then connect the existing PK audio engines and display the new HUD on the Canvas overlay. The normal server and simulator run one at a time on the same port.

**Tech Stack:** Node.js ES modules, native HTTP/SSE, browser Canvas/Web Audio, existing local CSS token/font and PK audio assets.

**Spec:** [2026-11-05-garden-retention-audio-camera-design.md](../specs/2026-11-05-garden-retention-audio-camera-design.md)

## Global Constraints

- Use only Garden's default port `4858`; do not bind `4859`, `4860`, or `4861`.
- Run Garden and simulator one at a time; simulator disables TikTok and saves to `data/garden-simulator`.
- Preserve Garden v2 players, crops, gold, levels, and history when adding session/title state.
- Gifts may change crops as they do now but must not directly add rank points.
- Reuse the existing `zodiac-paper-doodle-meme-v4` token, font, PK music/SFX code and assets; do not create images or add dependencies.
- Do not claim OBS or real LIVE validation.

## Review Focus

- Existing v2 saves must load into the new state without losing players, seats, crops, gold, XP or harvest history.
- A one-player session must still show a leader and next milestone; an empty session must not fabricate a winner.
- Repeated comments or gifts must not create rank points outside the defined game actions and existing cooldowns.
- Simulator reset must remain simulator-only and must not erase Garden's real save.
- Audio must tolerate browser autoplay restrictions and remain fully muteable without blocking game rendering.
- Overview and focus camera shots must keep all four tiers or the target plot inside the 1080×1920 frame.

---

### Task 1: Consolidate Garden to one port

**Files:**
- Modify: `garden/server.mjs`
- Modify: `package.json`
- Modify: `garden/server.test.mjs` only where it asserts the removed second listener
- Modify: `garden/README.md`

**Interfaces:**
- `startGardenServer({ port, dir, config, tiktok, simulator, now, log })` binds one HTTP server and returns `{ port, url, garden, camera, close }`.
- `npm run garden:sim` selects simulator mode on the same default port `4858`, with its existing isolated save directory and TikTok disabled.

- [x] Remove the second `share` listener and all Garden `sharePort`/simulator-port overrides; serve `/`, `/control`, static assets and local APIs through the one listener.
- [x] Preserve simulator-only guards for fake viewer/gift and reset APIs; update only existing server assertions for one-port behavior.
- [x] Update run instructions to show simulator and normal Garden use `4858` in separate processes, never concurrently.
- [x] Restart the active Garden simulator on `4858`, preserving its save, so only one Garden listener remains.

### Task 2: Add session scoring and lasting titles

**Files:**
- Create: `garden/competition.mjs`
- Modify: `garden/world.mjs`
- Modify: `garden/store.mjs`
- Modify: `garden/garden.mjs`
- Modify: `garden/garden.test.mjs` and `garden/store.test.mjs` only for changed contracts

**Interfaces:**
- `createCompetition({ state, now })` returns `score(user, action)`, `standings()`, and `finish()`.
- `finish()` closes the active session, snapshots top three and adds the matching persistent title once per viewer/session.
- `createGarden()` exposes current competition standings and session state; successful game actions pass through it once.

- [x] Extend save v2 to v3 with one persisted active session and lifetime counters/titles; preserve all existing user and plot fields.
- [x] Score first entry, planting, personal care, helping another player, pest clearing, harvesting and protecting a garden; gifts and raw comments score zero.
- [x] Keep scores scoped to the active session; deterministic ties use harvest count then earlier score time.
- [x] Award lifetime podium and milestone titles without changing existing gold, XP or gift balance.
- [x] Ensure `finish()` returns no winner for an empty board and handles a one-player podium.

### Task 3: Make the local control panel operational

**Files:**
- Modify: `garden/server.mjs`
- Modify: `public/garden/control.html`
- Modify: `public/garden/control.js`
- Modify: `public/garden/control.css`

**Interfaces:**
- `GET /api/status` includes `simulator`, session status, standings, players and camera state.
- `POST /api/session/finish` snapshots standings and opens the next session; only local host requests can call it.
- `POST /api/sim` and `POST /api/reset` remain simulator-only.

- [x] Add an always-available session status and finish/new-session action to `/control`; permit safe event and camera controls in either mode.
- [x] Keep viewer/gift simulation and save reset disabled in normal mode, with a direct same-port explanation and simulator command.
- [x] Show the live top three, personal score/title, connection mode and meaningful errors; avoid silent no-op buttons.

### Task 4: Reuse PK music and sound effects

**Files:**
- Modify: `garden/server.mjs`
- Modify: `garden/garden.mjs` metadata if needed
- Modify: `public/garden/index.html`
- Modify: `public/garden/garden.js`
- Modify: `public/garden/garden.css`

**Interfaces:**
- Garden metadata exposes existing `listMusic()` calm/upbeat playlists.
- The existing `public/music.js` and `public/sfx.js` engines load from the same Garden origin; music files resolve only inside the fixed project `assets/music` directory.

- [x] Safely serve only normalized music paths inside `assets/music`; keep existing `public/sfx/manifest.json` and files on the same server.
- [x] Map Garden join/plant/harvest/title/event moments to existing sound roles and reuse crossfaded low-volume music.
- [x] Keep `?music=0` and `?sfx=0` mute controls; autoplay denial must not stop overlay rendering.

### Task 5: Reduce camera zoom and give the idle shot full context

**Files:**
- Modify: `garden/config.mjs`
- Modify: `garden/camera.mjs`
- Modify: `public/garden/garden.js`
- Modify: `garden/camera.test.mjs` and `garden/view.test.mjs` only for changed expectations

**Interfaces:**
- Idle shots center the whole world and use `zoomWorld`.
- Joined, ripe, level-up, gift and theft shots use tier/plot framing capped below the current `2.5x` close zoom.

- [x] Center idle shots at the four-tier world center; set `zoomWorld`, `zoomTier`, `zoomClose` and event focus values so the full world or intended tier/plot remains in frame.
- [x] Add a visible focus ring/highlight for target plots so moderate zoom still identifies the event.

### Task 6: Upgrade the Garden HUD and scene decoration

**Files:**
- Modify: `public/garden/index.html`
- Modify: `public/garden/garden.css`
- Modify: `public/garden/garden.js`
- Modify: `garden/copy.mjs`

**Interfaces:**
- The existing Canvas remains the sole scene renderer; DOM overlays carry concise live data and interaction guidance.

- [x] Add a session podium, current leader's next milestone, session/event markers and a short command prompt within safe zones.
- [x] Give each cloud tier a small distinct vector landmark; add restrained drifting cloud/plant accents using existing token colors and paths.
- [x] Keep center-camera events visible, support reduced motion and avoid image/dependency additions.

### Task 7: Update user instructions

**Files:**
- Modify: `garden/README.md`
- Update: `docs/superpowers/specs/2026-11-04-vuon-may-design.md` as superseded by the approved 2026-11-05 spec

- [x] Document one-port mode switching, session controls/scoring/titles, sound mute settings, and the current limits on OBS/LIVE validation.

## Execution Notes

Use the native execution path in this session; the available collaboration policy prohibits agent delegation. Existing tests were updated where schema/camera expectations changed. The test suite was not run.
