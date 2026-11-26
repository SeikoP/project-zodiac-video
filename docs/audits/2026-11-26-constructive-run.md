# Constructive pipeline: run on the real episode (2026-11-26)

What was measured, and what was not. Nothing here is an approval; no gate was touched.

## What ran

`AgentManager.start_authoring_chain` on the real project (`studio-2b0c3a549a069efd273809f2`, 8 scenes), through the same
`_run_chain_group` the "Soạn hình ảnh" node now uses by default (`ZODIAC_STUDIO_CHAIN=on`). The proposal was not applied.

| Measure | Value |
|---|---|
| Wall time, cast to validated proposal | 284 s |
| Result | COMPLETED; `agent_authoring.proposal` accepted it (real validators) |
| Model calls (agent-task receipts) | 25, all `gpt-6-luna`: 1 cast, 24 menu choices. 0 `gpt-6.1-sol` (the vision look is not wired yet) |
| Scenes accepted first time | 6 of 8 (s03-s08) |
| Owner cards raised | 2 (s01: `VISUAL_DEPTH_UNDERDEVELOPED` after 2 re-choices; s02: three story-visual findings after 2 re-choices) |
| Build and render of the proposal | built; frames at 3, 11, 21, 30, 38, 48 s rendered (`.superpowers/live1/shots/sheet.png`) |

## Findings

- The s02 card was a false positive: the three findings (`NARRATIVE_BRIEF_REQUIRED`, `STORY_VISUAL_ASSET_ROLE_INVALID`,
  `STORY_VISUAL_COVERAGE_MISSING`) are filled in by the episode-level proposal, so checking one scene alone raised them and
  spent its two re-choices. Fixed in `authoring_chain.COMPLETED_LATER` (commit `303b2d23`). The run was not repeated, so it is
  not shown that s02 now needs no card.
- The scenes read as sparse: two characters far apart with one small prop between them; wall parts hang without a wall.
  Whether that is good enough is the owner's call on the stills.
- The project's `visual-intent.json` has drifted from its stored state (`VISUAL_SOURCE_DRIFT`), so the snapshot is refused.
  The measurement patched that read in the script only (treated as a fresh episode); the file was not touched. A click on
  "Chạy" in the app may hit the same refusal. The cause was not found.

## Not done (needs the owner)

- The plan's one-click run from "Giọng ✓" to the visual-review gate inside the app. It would apply the proposal to the
  project, build it and stop at a gate only the owner may confirm; it was not run because of the drift above and because the
  owner's own review is the point of that step.
- Model calls by role for the vision look: none, because `vision.review_current_build` is not part of the chain yet.

## Cleanup

- `nodes.json`: `checks` and `assets` carry an advisory `note` (no behaviour change; the registry ignores the key).
- The free-text scene/skeleton prompts in `agent_parts` are kept: `ZODIAC_STUDIO_CHAIN=off` and repairs still use them. They
  can go once the off switch is retired.
