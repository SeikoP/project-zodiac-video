# Phase 2 — Visual Production (Director v2)

Use the **existing Phase-02 manifest JSON**, Visual Grammar v4 and `references/design.md`; do not invent final job@5 fields. All original prerequisites, native compilers, conditional meme/effect work, story-beat choreography, and Publish Prep gates remain mandatory.

1. **Bootstrap:** read `orchestration/execution-bootstrap.md`, restore verified native source/assets and perform execution preflight. Author the original four Phase-02 inputs from Narration, then run strict authoring-input preflight. A preflight READY is not compiler PASS. Independent HTML or fabricated native SVGs never qualify.
2. **Director v2 plan:** read `references/director-performance-v2.md` and `references/contracts/director-plan-v1.schema.json`, author `.authoring/director-plan.json` from the exact approved `narration.txt`. Each voiced scene needs a beat identifying performer, action, semantic payoff, shot reason, native-state budget, and reaction or justified static hold. Do not create new SVG for each sentence.
3. **Story-first cast:** BEFORE accessing outfit/hair presets or running `--plan-only`, author `zodiac-character-assembly-plan@2` with per-character `design_intent` (role, identity tension, visual contrast, rationale for body/hair/face/outfit/shirt, a rejected alternative, line-grounded scene anchor, and purpose for every pose/state). `validate-character-intent-preflight.mjs` is mandatory for new v2.4.5 projects. Library assets are allowed only after decisions are justified by the approved Narration; native reuse is implementation, never the creative reason. Do not randomly hash shirt color for a lead.
4. **Native compilers:** V4 frame/mechanic; native cast body/hair/outfit; semantic prop/effect; structural environment; scene-direction compilation and existing validators. Run Character Assembly `--plan-only` before SVG write. The environment must be materialized and contact/caption-safe. No post-generation SVG deduplication or unsupported limb rigging.
5. **Meme & story-beat choreography:** keep `.authoring/meme-selection-review.json` even if rejected, inspect V4 meme-effect pair registry and execute its validators. Author `.authoring/story-beat-choreography.json`, validate effect enter/release, full scene events, semantic motion and visual quality. Event/owner/anchor lifecycle is mandatory. Do not force meme quota.
6. **Director v2 gate:** AFTER all native compilers and conditional Semantic Assets steps but BEFORE native preview pairs, run `node orchestration/run-director-v2-review.mjs <workspace>` (which invokes the Director gate, then native validators and preview-pair checks in order). A missing plan, failed gate, or stale receipt blocks Visual Review. Adaptive blocking is constrained to explicitly designated supporting entities; do not relayout cast or override native contact. If geometry changes, rerun affected native scene-direction, visual-quality, authoring scene-event validators with genuine receipts and invalidate stale preview pairs. The pixel footprint check calls Job@5's authoritative visual role-size validator.
7. **Visual Review:** wrapper must already have run `build-native-preview-pairs.mjs` and `validate-native-preview-pairs.mjs` after gate and native revalidation. Every event has two source-backed endpoints. Motion-only endpoints must be flagged; runner frame/temporal QA is separate and NOT implied. Secure explicit user Visual Review approval.
8. **Publish Prep and handoff:** preserve approved cover identity/copy; Phase 2 creates no ZIP. Phase 3 seals approved source then validates `zodiac-job@5`, parity, runner import, role size, CRC/roundtrip before exactly one ZIP. Only local runner can certify actual voice alignment/render parity and final MP4.

**Story Object V1:** A new project creates `.authoring/story-object-plan.json` based on approved Story Spine/Narration before drawing. The central native V4 prop must materially carry setup → friction → payoff, with effect tier 1 → 2 → 3 tied to actual authored events and voice anchors, not independent decorative SVGs. Read `references/story-object-effects.md`; run Story Object validator in Director Review before preview.

**Tone:** TONE_GAT_DEFAULT — sharp, punchy, expressive, no automatic softening. Prefer cause → reaction → payoff; a still reaction can be stronger than exaggerated animation.

**Failure boundary:** if native source or validators cannot be verified, stop with BLOCKED. Do not fabricate receipts, approvals or runtime playback.


## Director v2 audit hardening (2.4.1)
Director compile instructions cannot conflict across beats. Native phase review must be invoked after all Semantic Assets prerequisites; its wrapper re-runs validators and native preview endpoints. A failure rolls back `production.json` to the pre-review bytes and invalidates the Director gate receipt, not just a chat claim of review PASS. The phase manifest must declare this check as a required capability; missing capability wiring is a release blocker.

**Review boundary:** Native QC plus explicit human approval completes this visual-design gate. Remotion frame preview and final temporal QA remain exclusive to the local runner.

**Environment Frame (v2.4.7):** before Scene Direction, author meaningful
`environment.frame` slots and interaction contacts for every new acted
environment scene. Place performers with the same scene-owned frame as
fixtures and props; use real foreground split geometry/layer when seating
requires occlusion. Character-only closeups remain intentional. Run the
`environment_frame_v1` Director validator before native preview.
See `references/environment-frame-system.md`. No new job schema or phase.


## Cover Composition v2 (new v2.4.14)
Fresh Publish Prep must read `references/cover-composition-v2.md`, include `cover.design` derived exclusively from V4 style token and scene-native assets, run `node orchestration/validate-cover-design.mjs <workspace>` before Visual Review. Explicitly note the runtime must implement title shadow and scale; producer validation cannot assert final cover.png pixel parity. Do not replace environment with story object. Old approved covers remain compatible via `--allow-legacy` only.

**Background-only (2.4.38):** Apply `references/background-only-policy.md` before Environment Compile. A profile may not auto-create a desk/bed/chair; semantic story furniture must be authored as native props separately. Rerun binding/visual/story-event validators after environment changes.

**Composition v2.4.44:** Read `../phase02-composition-contract.md` before drawing and on resume. Inventory and depth belong to Art Direction data, not retained chat context. New precompile gate rejects missing/stale design hash, components, roles, states, geometry and relations.
