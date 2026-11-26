# Acting style, asset refresh, GUI e2e, main-1 → HyperFrames audit

Date: 2026-11-25. Owner: Cuong. Executor: inline. Human gates (content, voice listening, visual/video approval) stay PENDING.

## Findings (evidence)
- CORRECTION (user, 2026-11-25): `maket-acting-10s` is a demo with its own style that supplied ideas; it is NOT the canonical style and Workstream A must not clone it. The style definition is to be agreed before building (see A.0).
- Idea source: `tmp/maket-acting-10s`. It animates only existing SVG poses with: whole-figure lean/recoil pivoting at the feet, a coordinated actor+prop pull that keeps hand-to-handle contact within 2px, mirrored reach pose, hard-cut pose swaps on measured word anchors, camera push-in/out (1.12–1.16x), captions split at clause boundary.
- Studio today (`contracts/motion-registry-v1.json`, `runtime/.../semantic-motion.mjs`, `visual_preview.mjs`): 9 motions only. subtle-tilt ≤3.5°, small-bounce ≤20px, focus-shift ≤6%, slide ≤360px bound to pen→notebook or `near` geometry. No camera track, no pivot-at-feet lean, no linked group motion, no mirrored pose. So the demo cannot be authored or rendered by Studio.
- main-1 has 24 `.zodiac-work/v2/jobs/*` (Remotion-era: `render-plan.json`, `production.ir.json`), 11 ready zips, Nhân Mã: jobs `nhanma-cai-xong-la-reset`, `nhanma-cham-nho-tren-ban-do`, handoff `phase1-done/love-sincere-nhan-ma-phase1-handoff-v7.zip`. main-2 imports Phase 1 handoffs only; no importer for those Remotion jobs.
- Asset library v4: 25 character files, 75 props, 42 memes, 10 environments, 31 scene-set files (hash-bound).

## Workstream A — Acting style in Studio (first)
0. Style definition: write a short style spec (which traits from the demo ideas to keep, drop or change) and get the user's approval before any code. No implementation until then.
1. Contract: new motions in a v2 motion registry: `lean` (rotate+translate, pivot bottom-center, up to 20°), `recoil`, `pull-with-prop` (group of entities, shared translate), `camera-push` (scene-level scale+translate), plus `mirror` pose flag. Old 9 motions unchanged; registry sha is part of compiler identity so builds rebuild.
2. Compiler: validate group members exist and contact points (hand/handle) stay within 2px; reject camera beyond 1.25x or leaving canvas.
3. Painter (`resolveSemanticMotion` + `createScenePainter`): implement the motions deterministically, stepped on twos, shared by preview and MP4.
4. Tests (RED first): unit tests per motion; a regression that rebuilds the maket 0–10s sample from Studio intent and compares key frames at 2.65/6.7/8.15/9.75s with the demo within tolerance.
5. Agent: add acting presets to the visual proposal context so the agent chooses them.

## Workstream B — GUI e2e for Nhân Mã + GUI readability
1. Drive the real GUI (desktop control on the user's machine) with `love-sincere-nhan-ma-phase1-handoff-v7.zip`: import → voice → visual → build → export, recording every step that confuses.
2. Fix the confusing parts: single "next action" banner, plain Vietnamese step names, visible log of what the agent is doing.

## Workstream C — Asset refresh
1. Inventory current characters/expressions; list over-exaggerated expressions (ledger with ids).
2. New character set and expression grid, props and environments, same IDs/contract so the compiler and hash-bound references keep working; replace art per category, rerun library validation.
3. Needs user visual approval per batch; never self-approve.

## Workstream D — main-1 vs main-2 HyperFrames gap audit
Read-only comparison: renderer features (captions, opening/cover, music/sfx, memes, effects, depth), importer coverage, validators. Output `docs/audits/2026-11-25-main1-hyperframes-gap.md`.

## Order and stop conditions
D (read-only, informs A/C) → A → B → C. Stop only for destructive or irreversible actions, security-sensitive actions, effects outside the worktree. No commits (git unusable in VM).
