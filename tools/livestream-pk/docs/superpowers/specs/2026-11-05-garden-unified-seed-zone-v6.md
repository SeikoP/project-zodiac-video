# Garden v6 — Unified Continuous Rack

**Decision:** One Seed Zone, one continuous 16-shelf × six-pot rack, 96 active seats. Replaces the A–D presentation modules. This is the implementation companion to the CAAS design document dated 2026-11-05.

## Product requirements

- Keep the logical ID `cloud-1` for backward-compatible saves; do not create secondary garden zones.
- Stable per-user `slot` / `plotId`; fill distant rows before adjacent rows without moving seated users.
- Camera overview must encompass the whole active Seed Zone and protect the top and bottom HUD.
- At high density, show compact, stable pot IDs such as `#012`, rather than illegible full names.
- Group rapid joins and announce assigned pot IDs, so viewers can locate their pot.
- Focus shows owner, crop condition, and actionable CTA. Text must draw in screen space above shelf lips; avoid frame-bound clipping.
- Pot crop origin must overlap the soil opening, not float above the pot; front rim covers only roots.
- **Normal base maturation:** rau 10m; hướng dương 12m; nấm mây 15m. Watering, fertilization, pests and live events remain gameplay modifiers; accelerated cycles may be shorter. The old baseline of 3/5/8m is retired.
- Likes rotate through A: one eligible crop gains a limited growth nudge at 100 hearts; B: eligible garden crops gain a limited nudge at +400 hearts; C: a randomly selected awake participant receives a small lucky reward at +500 hearts. Then repeat. A burst triggers at most one presentation milestone immediately and the remaining thresholds drain on ticks.
- Cumulative growth from hearts capped at 10% per crop. Likes do not plant, seat, harvest or cause raw camera beats.
- Keep 15–20 idle / 30 active / ~45 camera-event FPS targets; no per-heart DOM or SFX spam.

## Acceptance

| Test | Required |
| --- | --- |
| 12/24/48/96 seated | Same zone, no overlap, balanced stable placement |
| All crops/variants/tiers | Visible root-soil contact and pot-foot shelf alignment |
| Overview | Full rack visible, stable pot IDs / statuses, HUD clear |
| Focus + events | Name, crop condition and CTA never covered by shelf |
| Growth | Base 10/12/15m with controlled clock; boosted timing tested separately |
| Hearts | A→B→C→A; spectator-safe; duplicates not double-applied where message IDs exist; bounded bonus |
| Saved state | Legacy cloud migration and heart round-trip, no loss of crop/progression |
| Regression | No new Garden-specific test failure |

## Known implementation follow-ups

- This design requires real screenshot verification at 12/24/48/96 players and crop variants; Node tests alone are not sufficient to certify visual acceptance.
- If 16 shelves fitted to portrait overview reduce legibility, use adaptive labels / more precise camera bounds rather than violating six pots per shelf.
- The pre-existing `quick-room.test.mjs` failure is outside Garden and should be tracked independently.
