# Constructive visual pipeline — design

Status: **draft for owner approval, 2026-11-26.** Nothing in this document is built yet.
Owner decisions so far: reorder the work so the result is built correctly step by step instead of "AI writes everything, then
checks, then skip/loop"; run automatically; keep the GUI short; "tùy bạn" on how to build it (my calls are marked **[call]**).

## 1. Intent and why

Today the Hình ảnh phase works like this (`tools/studio_project/pipeline/nodes.json`): one agent run writes a ~43,800-character
Visual Intent (cast, every scene, props, events, transforms, experience profile), then `checks` judges it, then `assets`, then
per-scene compile. The model never sees what it wrote. Observed failures in this repo, each one a loop that cost minutes:

| Seen | Real cause |
|---|---|
| `library:props/table.svg` (no such prop) | free text where an enum belongs; "assets" resolved *after* the choice |
| pose `side-eye` (it is an expression) | free text |
| event to a state the entity never listed | free text |
| `depth__notebook` named as a story entity | bookkeeping the model should not do |
| 9 "experience" issues, pipeline stuck after 2 tries | quality rules gate the pipeline; only exit is typing prompts |
| Apply button with nothing to look at | proposal is text; no frame exists before apply |

The fix is the order of work, not more repair code: every decision is made in dependency order, from a menu of things that
exist, assembled by Core, built and looked at **at the step that made it**.

## 2. Goals / non-goals / anti-goals

Goals
- One click runs Hình ảnh to the visual-review gate without the owner babysitting; the owner sees stills, not JSON.
- A scene cannot reach the build with an invented prop, pose, state, anchor or coordinate (**valid by construction**).
- Every failure has exactly one owner: Core (no model), the model (bounded, only the failing scene, re-choosing from menus),
  or the owner (one card with a default). No unbounded loop, no dead end.
- GUI: four stages and one primary action. Internal steps are available under "Chi tiết", not in the way.

Non-goals
- No new art. A missing prop/model still returns `NEW_VARIANT_MASTER_REQUIRED` (Visual V5 spec); no fabricated SVG.
- No change to the human gates: voice listening, visual review and export approval stay owner-only (AGENTS.md).
- No rewrite of the compiler, voice, or export.

Anti-goals (a failure even if it technically works)
- Another validator layer. Another repair loop. A pipeline that "passes" by hiding warnings.
- Spending sol quota on anything but looking at frames.

## 3. Constraints

- Quota policy already in `agent_bridge.ROLE_DEFAULTS`: luna for authoring and repair, sol only for `vision`.
- Codex app-server `turn/start` accepts `outputSchema` (verified in the generated protocol schema). Not used by Studio today.
  Whether the account's model honours a strict enum schema is **unverified** → the spike (§6) answers it.
- Existing tests (≈713 Python, Node suites) pin node ids and the Visual Intent format; the compiler caches per scene and per asset
  (verified, `tests/studio_prop_model_cache.test.mjs`), so scene-level rebuilds are cheap.
- The V4 library already declares a constructive compile (`manifest.json` pipeline: frame_skeleton → mechanic →
  character_assembly → meme_prop_compile → skin_binding → environment_composition → scene_direction_compile) and says
  "Visual Grammar selects roles; Scene Direction owns final placement". Studio's authoring bypasses it by letting the model write
  `transform {x,y,width,height}`. Whether that compile can place entities from a frame + bindings is **unverified** → spike.

## 4. Approaches considered

- **A. Keep the node graph; replace the inside of "Hình ảnh" with the new chain; GUI shows one node.** Lowest risk, reuses
  derive/receipts/autopilot/tests.
- **B. Rewrite the graph and GUI around new nodes.** Cleanest, but touches derive, evidence, receipts, autopilot and most pipeline
  tests; high risk.
- **C. Spike first: run the new chain on 1–2 real scenes, then decide A or B.** Proves the one bet (menu-constrained output
  builds valid scenes without a repair loop) before restructuring.

Chosen (owner: "tùy bạn"): **C, then A** **[call]**. Reason: the whole design rests on that single bet; B only pays off if A cannot
hold, and the spike will show that.

## 5. The design

### 5.1 Order of work (per episode, automatic)

1. **Cast** — the model picks from menus: body profile, hair, outfit, shirt colour, and for each cast state a pose and an
   expression (grouped by meaning, `catalog_v5.POSE_GROUPS` / `EXPRESSION_GROUPS`). Core writes ids, `design_intent`, cast plan.
   Output: a cast sheet still.
2. **Stage, per scene** — the model picks: shot layout, mechanic, who is present (slots filled from the cast), props from the family
   catalog (one entry per family/model, plus "none"), optional set dressing (a prop id or none). **Core** computes every
   transform from the layout slots, adds `depth__*` dressing as required, fills `experience_profile` and `story_focus` from the
   choices. Output: scene compiled now, one still.
3. **Act, per scene** — the model picks events from menus: anchor = one of the measured words/phrases of this scene
   (enumerated), target = a present entity, action = a short Vietnamese phrase, new state = one of that entity's states. Core
   sets triggers, timing, `enter` rules. Output: scene rebuilt (cache-scoped), one still at the beat.
4. **Look** — per scene, the existing frame review (`vision` role, sol) judges the still against the scene goal. A finding triggers
   at most **two** targeted re-choices of that scene's Stage or Act (luna), then the scene is marked "cần bạn" with a default.
5. **Seams** — transitions, cover, publish copy (deterministic drafts already exist), episode build, then the **visual review
   gate** (owner).

Scenes run in parallel (2 at a time, as today). Steps 2–4 of one scene never wait for another scene.

### 5.2 Failure ownership (replaces "check, then loop")

| Kind | Owner | What happens |
|---|---|---|
| Impossible to write (menu) | none | cannot occur |
| Mechanical (placement, ids, derived fields, caption lane, canvas) | Core | fixed in code, recorded, no model call |
| Creative ("static scene", "focus unclear") | model, bounded | ≤2 re-choices of that scene only, then owner card |
| Missing asset | owner | request recorded (`.authoring/asset-requests.json`). Set dressing: the closest real prop is used and reported. A story prop: the menu never offers what does not exist, so this only arises when the story needs something the library lacks; then one card (*use the closest / skip the prop / request art*) |

Quality rules are scores shown under "Chi tiết". Only "cannot build" stops a scene. The only blocking decision for the owner is the
final review gate, plus at most one card per stuck scene: *[Chấp nhận] [Đổi bố cục] [Soạn lại cảnh]* with the default highlighted.

### 5.3 GUI

```
Nội dung ✓   Giọng ✓            ← listen & approve (owner gate)
Hình ảnh   [██████░░ cảnh 5/8]  ← one progress bar, one button
           stills strip: s01 s02 s03 s04 ▢ ▢ ▢ ▢   (click = larger, with its Chi tiết)
           Chi tiết ▾  (old nodes, logs, scores — collapsed)
Xem & Duyệt hình (owner gate)   →   Xuất
```

"Chạy lại" is always visible and reuses everything that is still valid (the same rule as `_reusable_parts`).

### 5.4 Data

Menu answers are a few hundred bytes per scene (instead of 43,800 characters per episode). Core assembles the existing Visual Intent
format, so compiler, export and tests keep working. A reset of the app loses nothing: parts and results are read from stored tasks
(already implemented in `agent_runs`).

## 6. Step 0 — the spike (needs the owner's go; spends a few luna calls)

Run Stage + Act for **2 real scenes** of the Nhân Mã episode with `outputSchema`, assembled by a throwaway script. Answer:
1. Does the account's model return schema-valid choices with enums of this size (props, poses, anchors)? Rate over ≥6 calls.
2. Can the plugin's scene-direction/grammar compile place entities from a frame + bindings, or must Core own a small placement table?
3. Do both scenes compile and pass structural validation with **zero** model retries? Time per scene (target < 60 s)?
4. Do the stills look acceptable (owner's eye, sol vision optional)?

Success = (1) ≥ 90%, (2) a placement route exists, (3) yes, (4) owner agrees. If (1) or (3) fails, adjust menus before building more;
if (2) fails, add a Core placement table. Failure of the whole bet reopens approach B.

## 7. After the spike (approach A, outline)

New `authoring_chain` behind the existing "Hình ảnh" node; `nodes.json` and derive stay; `checks`/`assets` run inside the chain
or as "Chi tiết" scores; GUI StepList collapses the phase to the stills strip; old per-step buttons move under "Chi tiết".
Detailed tasks go to the plan (writing-plans) after approval.

## 8. Left to the builder

Exact schema field names; layout-slot to transform mapping details; the stills strip component; how scores are persisted;
migration of the existing `checks` rules that are structural vs advisory (list them in the plan).

## 9. Calls I made (not agreed with the owner — please check)

- C then A, not B. Scenes in parallel two at a time. At most two model re-choices per scene, then an owner card.
- Quality validators become advisory scores; "cannot build" is the only stop inside the chain.
- A missing asset lets the scene continue with the closest real option and records a request (dressing only; a missing *story*
  prop still asks the owner, per the V5 spec).
- sol stays vision-only; luna does all choosing.
