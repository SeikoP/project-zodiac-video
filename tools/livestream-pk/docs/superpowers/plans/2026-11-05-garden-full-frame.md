# Garden full-frame implementation plan

**Goal:** Fill the portrait frame with larger plants and readable care feedback, with cooperative pest events.
**Approved design:** Use the full 1080×1920 frame without TikTok safe zones. Enlarge pots and names; show care state, event instructions, countdown, shared target and results. Preserve player progression and 48 seats.
**Architecture:** Reuse existing rack geometry, camera, event controller and coalesced effects. Two wings each become eight shelves of three pots; IDs and saved crops stay intact. No dependencies.

- [x] Layout: update config and camera fit, test every shelf stays in frame and pots grow visibly; update geometry fixtures.
- [x] Cooperation: `bắt sâu @tên` helps a neighbor; bare command clears own pests first then a storm target. Count each storm plot once, reward contributors at the shared target. Test empty storms, unrelated pests, repeated clears, expiry and command routing.
- [x] Feedback: keep event instructions visible, show shared target/reward/results and local action effects; make overview care labels readable. Verify simulator screenshots at 12/48 players and events, plus Garden tests.

Risks to check: eight rows must not overlap; large crops must anchor to shelves; empty/late storms must not create free rewards; coalescing must retain bounded local feedback; old saves retain IDs and progression.

Verification: 130 Garden tests passed. Chromium inspected at 1080×1920 and 360×640, with 12/48 players; no page errors. A fresh simulator storm cleared 21/21 affected plots and announced 21 contributor rewards. Evidence is in ignored `data/garden-review/`. Full suite: 538/539 passed; unchanged `game.test.mjs` performance assertion exceeded its 1500ms budget (3124ms parallel, 1521ms serial). No LIVE/OBS validation or release build.

## Follow-up: readable plants and contextual close-ups

User feedback: cards cover pots, plants look alike, camera/events need stronger close-ups, and the detail card must sit beside the selected plant.

- [x] Move overview names to the shelf edge, remove duplicate canvas detail cards and floating avatar stakes.
- [x] Give five pot tiers colored materials and emblems, distinguish growing cabbage/sunflower/mushroom silhouettes, retain crop variants.
- [x] Compose 2.35x close-ups with the plant at x=370 and a 350px card on its right; track position every rendered frame, show only after arrival, keep the halo behind the subject.
- [x] Add harvest/ripe shots, coalesce repeated beats, open events wide then visit a relevant plant; cancel queued event shots on event end. Routine watering and joins stay quiet.
- [x] Verify: 136 Garden tests and 545 full-project tests passed (full suite sequential). Chromium checked actual gift/event close-ups at 1080x1920 and 360x640; card stays 28px beyond plant bounds, no page errors. Evidence: `data/garden-review/v2-*.png` and `v2-browser-check.json`. No LIVE/OBS check or release build.

## Follow-up: expanded header, full-height rack and gift impact

- [x] Expand the left header to 620px and leaderboard to 400px; show six compact ranking rows with highlighted podium ranks. All six rows fit inside y=300, including when the leader earns a title.
- [x] Remove the shot-label card and canvas zone banner. Put the zone title above the rack; enlarge overview pots to about 128px and use the bottom down to the last name at y=1855. Notifications share the header dock and retain their visible reading time while an event or gift occupies it.
- [x] Emit measured gift progress changes and affected counts. Show sender, tier-specific icon and real impact. Rain/tree gifts present the affected garden before a sender close-up; gift bursts retain the strongest tier and merge per-plot growth. Full-room gifts with no seat retain the wide presentation.
- [x] Rain now waters awake crops; merchants select a crop actually present when available. Event HUD shows countdown, relevant counts and the shared pest target. Keep an event ticker visible during gift notices; show configured harvest multipliers on eligible plants.
- [x] Verification: 145 Garden tests included in 554 passing project tests (sequential). Real simulator APIs and Chromium: six ranking rows fit, gift/event close-up card remains beside its plant, magic rain affected 36 crops and tree affected 24, pest rescue completed and announced its rewards. 360x640 reduced-motion browser also retained the event ticker during a dew gift. No page errors. Evidence in `data/garden-review/v3-browser-check.json`, `v3-gift-frames.json`, `v3-mixed-diagnostic.json`, and `v3-*.png`. Wide gift screenshots freeze a real presented frame with the browser clock and camera lock; the separate end-to-end run verifies automatic wide-to-close transitions without a lock. No LIVE/OBS validation or release build.

## Follow-up: actionable play loop and automatic sessions

- [x] Enlarge the close-up card to 390px with 38px name / 29px action, add gold and XP, and put nine rotating guides in the unused right side of the left header.
- [x] Add free `chăm` (pests, weeds, then water), planting/harvest aliases and actionable response messages for known commands. Include actual remaining cooldown, missing gold/level and valid next steps. Show brief local feedback and route card/care requests through the camera without zooming repeatedly for cooldown spam. Routine successful care leaves the guide dock available.
- [x] Add per-plant problem covers for pests, weeds, dry soil and impending inactivity: show 4 seconds, remain quiet 20 seconds, clear when resolved. Prevent the overlay from suggesting planting over a still-growing crop.
- [x] Change base growth to 3/4/5 minutes. Automatically finish ten-minute sessions, award Top 3 and open the next session; preserve active crops and long-term progress. Keep manual session finishing. Display only current-round points and a live countdown.
- [x] Hide idle pots at 90 seconds, release pot/crop at 3 minutes and retain the player's gold, XP/level and titles. Returning comments receive a new seat. Legitimate command attempts maintain presence even when blocked.
- [x] Diversify gifts without direct gold/XP purchases: dew waters, star fertilizes, magic rain waters/weeds the active garden, tree grants a 60-second shield against theft and new infestations. Preserve measured growth reporting, bound the effect sample and retain the strongest gift in a burst.
- [x] Repair the browser's calls to text functions omitted by JSON serialization, covering level-up and theft/catch feedback. Host control uses the same server response messages and has a smart-care button.
- [x] Verification: 156 Garden tests; 565 full-project tests passed sequentially. Real simulator HTTP + Chromium exercised care, cooldown, premature harvest, insufficient gold, 390px adjacent card, harvest/level-up, all gift roles, theft/catch, automatic session rollover, inactive release and returning-player preservation; no page errors. Clock jumps test timed behavior without waiting ten real minutes. Artifacts: `data/garden-review/v4-browser-check.json` and `v4-*.png`. No LIVE/OBS acceptance or release build.


## Award ceremony, fresh rounds and gift roulette (latest user revision)

This section supersedes the earlier rule that retained crops/gold across rounds.

- [x] Active session 10 minutes → award podium 8 seconds → fresh round. Top 3 receive 15/10/5 XP plus persistent titles; repeat finish calls and save/restart never pay twice.
- [x] Clear crops, seats, gold, round scores, weather, thefts, hearts, care timers and temporary effects. Preserve LV/XP/titles/career; reset starting gold to 20. Publish plot tombstones so connected overlays remove the previous round's plants.
- [x] Pause comments/likes during awards with an explicit remaining-time response. Persist incoming gifts and replay them once after the new round starts. Growth gifts include a rau seed on an empty pot, without charging gold, so the fresh garden still receives an actual benefit.
- [x] Single server growth-rate calculation for simulation and UI. Water adds +25% for 30s; fertilizer adds +18% until harvest; healthy combined rate displays +48%. Show crop progress, boost sources/expiry and a separate XP-to-LV meter; use the server's XP thresholds.
- [x] Remove the bungmoto/shared-greenhouse brand row. Place routine notifications in one zone line and retain rotating header guides. Success feedback no longer covers healthy plants. Only explicit cards and significant milestones/gifts/events drive the camera.
- [x] Gifts of 50–99 xu spin six server-selected outcomes: self speed/fertilizer/shield, or temporary rival slow/dry/weeds. Protected rivals and ineffective targets are excluded; counter-actions and expiry restore temporary pranks without undoing repairs. Match the animated wheel to the server outcome, deduplicate the raw-event/camera presentation, and retain wheel notifications arriving during another gift.
- [x] Update control copy/actions, queued-gift feedback, round reset confirmation, native tests and consolidated Garden README.
- [x] Verification: **572/572** full-project tests with `node --test --test-concurrency=1`; **163** are Garden tests. The default concurrent suite had one unrelated wall-clock performance failure in game.test.mjs while Chromium QA was running (1724ms vs 1500ms); no performance threshold was changed, and the sequential full suite passed. Syntax checks and `git diff --check` passed.
- [x] Native simulator HTTP + Chromium: quiet care camera, +25 → +48 growth UI, 390px adjacent card with 28px plant clearance, a wheel arriving while another gift is visible, correct wheel target, ceremony reload/idempotence, queued gifts, fresh round with preserved XP/20 gold/new gift seed, and mobile viewport. No page errors. Evidence: `data/garden-review/v5-browser-check.json`, `v5-overview.png`, `v5-zoom-speed.png`, `v5-roulette.png`, `v5-awards.png`, `v5-new-session.png`, `v5-mobile.png`.
- [x] Updated only the existing isolated simulator preview at port 4858; it has TikTok disabled. No production save edits, release build, packaging, commit or LIVE/OBS acceptance.


## Boss rounds, destructive gift skills and overview profiles (latest revision)

This revision replaces the previous 1,000-xu tree gift and the camera action for `vườn`.

- [x] Roll boss presence once per round (35%). Spawn at 2 minutes for a 60-second encounter, HP = active pots ×40 clamped to 300–2,000. Persist HP/phase/contributors. Count each valid heart once as damage without also filling normal heart milestones; known contributors maintain presence. Win rewards: 8 XP, 5 gold and a persistent bossSlayer badge, paid once. Timeout gives no win reward. Round changes clear the encounter.
- [x] Keep 50–99 roulette; 100–499 rain; add 500–999 meteor and 1,000+ cataclysm. Outside boss fights, destroy 1/up to 3 random unshielded active rivals' crops. Reset progress, crack pots for 8s, cancel old theft records and grant one free rau replant. Preserve LV/XP/gold/titles. Sender gets a ripe crop and 60s protection. During a boss fight, offensive gifts instead deal 25%/60% of max HP without destroying rival crops.
- [x] Introduce one foreground presentation queue: skill gifts > roulette > normal gifts > profile cards. A gift immediately dismisses a profile; an ongoing gift keeps its readable duration. Deduplicate gift IDs, coalesce repeated pending profiles and cap profile backlog without discarding gifts. Camera gift beats preempt non-gifts within 800ms and stay in overview; boss entrance removes obsolete event close-ups and retains gifts.
- [x] `vườn` opens a 5s main-screen profile with an 8s per-user cooldown and does not create a camera shot. Show live crop/XP meters, problem sources, titles and recovery instructions. Do not display a queued profile for a reassigned plot owner.
- [x] Add native boss/meteor SVG stages, HP/countdown/contribution UI, damage feedback, cracked-pot visuals, and mobile/reduced-motion behavior using existing palette/fonts. One foreground scene at a time. Simulator control exposes force-boss and 50-heart testing; the force endpoint is forbidden in normal mode. Keep viewer identity on simulated likes, matching the real TikTok likeOf → diagnostics.wrap → garden.like path.
- [x] Update old gift/camera tests to the revised laws, add boss persistence/reward/timeout/invalid-input/shield/replant/queue/native-HTTP coverage, and update README/control instructions.
- [x] Validation: **582/582** full-project tests (`node --test --test-concurrency=1`), including **173 Garden tests**. Syntax checks and `git diff --check` pass. Native HTTP + Chromium exercises profile without zoom, gift preemption and ordering, three real destroyed crops with shield exclusion, timed free replant, boss HP from both API and control-button hearts, gift-to-boss damage, victory/reward, timeout, clean round reset, and mobile viewport. No page errors; every reviewed shot remains at overview zoom ~0.914. Artifacts: `data/garden-review/v6-browser-check.json` and `v6-{overview,profile,cataclysm,boss,boss-strike,boss-win,mobile,awards}.png`.
- [x] Restarted only the existing isolated simulator preview on port 4858; TikTok disabled. No production save edits, release build, packaging or commit. Actual LIVE/OBS acceptance remains unverified.
