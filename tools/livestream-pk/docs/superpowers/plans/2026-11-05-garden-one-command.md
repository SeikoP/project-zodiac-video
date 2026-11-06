# Garden One Command Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Execute inline in the existing checkout to preserve the user's uncommitted Garden integration.

**Goal:** Complete the Garden loop with `chăm` and retain sparse-room pots throughout the session.
**Architecture:** Resolve care to existing native actions, with resolvedAction preserved for feedback/scoring. Reclaim one stale pot on newcomer admission only when near capacity; share owner visibility across growth, camera, status and browser.
**Tech Stack:** Node ESM, node:test, Canvas/DOM; no dependencies.
**Spec:** ../specs/2026-11-05-garden-one-command-design.md

## Global Constraints

Preserve existing dirty changes; no automatic commits/release or real TikTok connection. One comment performs one action. Near-full threshold ceil(capacity × 6/7), default36/42; stale threshold evictAfterMs, default180000ms. Keep existing aliases and paid seed validation.

## Review Focus

- Mention care must never plant or harvest another user's crop.
- Ripe crops with pests harvest once, score once, and leave an empty pot.
- Full rooms must never evict an active empty pot or delete progression.
- Old sleeping saves and status/camera filters must not hide retained pots.
- Boss/awards/cooldowns and gift replant credits retain native restrictions.

### Task 1: Native care and presence

Files: garden/garden.mjs, world.mjs, care.mjs, config.mjs; garden/one-command.test.mjs and existing behavior tests.
- [x] Add assertions for a complete care loop, mentions, event help, paid/free planting, retention, exact near-full admission, and safe full-room rejection; run and observe failure.
- [x] Resolve care using plant/harvest/catchPests/clearWeeds/water and existing competition scoring. Keep returned resolvedAction.
- [x] Reclaim one eligible stale pot on admission and stop timer-based sleep/eviction. Wake retained legacy plots at initialization.
- [x] Update replaced presence expectations; run focused tests.

### Task 2: Connected presentation and rehearsal

Files: garden/copy.mjs, server.mjs, sim.mjs, README.md, INTEGRATION.md; public/garden/view.js, garden.js, index.html, control.html, control.js; server/view/copy/interaction tests.
- [x] Connect status/camera to shared isAwake policy; add HTTP/poll regression test.
- [x] Update context guides, action/problem feedback, recovery, seasonal events, control quick actions, demo and bots to `chăm`. Keep legacy actions in advanced controls.
- [x] Document retention and seed cost; run focused suite then full suite sequentially and inspect diff.

## Ledger

- User approved implementation, one-command care and demand-based retention in the existing dirty workspace. No worktree split: current Garden changes are required integration context.

- Verification: full sequential suite 665/665 passed; dedicated native cases 8/8; HTTP/poll regression passed. Final CTA changes rechecked with view/copy/native tests 45/45.
- Fresh read-only reviewer found a remaining profile CTA discrepancy (ripe pests and paid fertilizer hint); reproduced in Chrome before fix, corrected to care/harvest ordering. Existing dirty files retained, line endings preserved.
- Runtime: existing PID14136 is a normal Garden server. Left running without restart/TikTok reconnect; new backend behavior requires next intentional restart and browser reload. Real LIVE/Studio delivery and listening remain unverified.
- Browser acceptance: Chrome headless passed native care loop, retained pot/status, ripe-versus-pest hints, one primary quick action and actual Control demo; zero page errors. Evidence: logs/garden-one-command/browser-report.json, overlay.png, control.png. Temporary isolated server closed afterward.
