# Director v2 — performance + adaptive blocking contract

Version: `zodiac-director-plan@1`. Active inside existing Phase 02 Visual Compile/Semantic Assets; no new agent, no fourth phase, no Job@5 schema changes.

## Source of truth
- Approved `narration.txt` is immutable; `narration_sha256` in `.authoring/director-plan.json` must be the SHA-256 of its exact bytes.
- Each speaking scene has one or more Director beats. A beat is an authored performance instruction, not a requirement for a new SVG.
- `performer` and optional `target` are real scene entities. For two-character dialogue, use existing two-person `speaker`/`listener` bindings, never spawn a third character.
- `action`, `reaction`, `semantic_purpose`, `shot_reason` and `visual_payoff` explain what the audience should understand. For a static beat, select `hold` with `static_reason`; never insert random wiggles to satisfy motion quotas.
- Anchors must occur in that scene's exact voice, with `occurrence` when ambiguous. Events are only from `contracts/motion-registry-v1.json`; no aliases invented for runner 2.0.1.
- `asset_cost_reason` must justify native state re-use or a necessary new state **before** creating SVG assets; preserve character identity, shirt palette and V4/Human Stroke v2.

## Blocking
`blocking` is an optional per-beat list of `{entity_id,anchor,side,relayout}`. Supported side values: above, below, left, right, between, above-left, above-right, below-left, below-right. For `between`, supply `secondary_anchor`. `offset_px` optional, bounded 0..180.

Adaptive placement works only on **explicit** non-character supporting entities, after native assets and Scene Direction compilation; existing transforms are preserved unless `relayout:true`. The compiler never moves hero/cast identities, never changes frame profile, no randomization, and refuses to override native contact/pen-slide `points_to` bindings. It preserves aspect ratio by scaling both dimensions together and transfers the same solved transform to every state of an entity. Wrong placement fails explicitly rather than hiding an effect, shifting characters or inventing props.

## Director gate
After Phase-02 native core and meme/environment capabilities are complete, and before building native preview pairs, execute:

```bash
node orchestration/run-director-v2-review.mjs <workspace>
```

`DIRECTOR_V2_GATE` and post-compile native validators are blocking. The wrapper writes `.authoring/director-v2-review-receipt.json` and stops on the first failed validator; it never grants human review approval. It validates authored intent, exact Narration SHA, voice anchors, performer/target, supported motion, causal order, authored blocking, pixel-space safety, and **reuses** Job@5's authoritative visual-role footprint validator. Use the existing compiled source-backed preview pairs after this gate. A missing plan, failed gate or stale preview pair means `VISUAL_REVIEW` is blocked.

The gate is **static**. Motion-only endpoints, anticipation/easing, frame-by-frame effect contact, measured voice timing and final video parity remain local runner responsibilities; never fabricate a runner PASS. Unsupported movement blocks export or must be reauthored into supported native states/events.

## Channel performance
Preserve `TONE_GAT_DEFAULT`: sharp, assertive, punchy narration. Emphasize readable cause → reaction → payoff. A cutting punchline may be held in a quiet close-up; do not add a meaningless effect, meme or shot cut. No forced soothing voice, random camera movement, gratuitous insults or arbitrary asset quota.

## Production hardening — audit 2.4.1
- One supporting entity cannot have conflicting `blocking` instructions across several beats in the same scene; identical duplicates are also rejected (single owner for one transform).
- A `between` instruction must resolve a distinct second anchor; no implicit anchor fallback.
- `run-director-v2-review.mjs` restores `production.json` from its exact pre-review bytes whenever any post-compile QC stage blocks. A partial gate receipt is then marked BLOCKED; do not use preview files from a blocked review.
- The original source/approval remains authoritative. Never count static PASS, native preview pairs, or ZIP-ready as local renderer frame-by-frame QA.

## Environment Frame Integration — v2.4.7

Scene Direction first places the *baseline* shot, then applies an authored
`environment.frame` that jointly positions the character, story fixture,
hand prop and optional foreground. Keep each state's authored relative position
delta; never flatten two actions to identical transforms. Character geometry
comes from Character Design Intent and native V4 states, not from the available
background catalog. Director v2 still cannot arbitrarily relayout heroes:
frame placement is explicit authoring, not Director guesswork.

The `environment_frame_v1` review stage checks source slots against actual
compiled transforms, contact projection, V4 style IDs and real occlusion
footprints. A fresh acted environment needs this plan; it cannot pass merely
by borrowing a room profile. Renderer/timed Remotion QA remains downstream.


## Renderer 2.0.1 actor slide parity (v2.4.10)
`slide` is not automatically a generic visual effect. For an entity moving from
`state_before` to `state_after` it requires a real `near` spatial binding to
another scene entity, unchanged width/height/scale/rotation, finite on-canvas
start/end geometry, and 24–360px authored travel. The runner interpolates
translation smoothly over the event and adopts the next SVG state at event end.
The legacy pen→notebook `points_to` profile remains a separate same-state
contact gesture. Producer Phase-02 motion QA and Phase-03 release both reject
unresolvable `slide` events; preview after/before stills alone are insufficient,
so the local runner must also produce an animation clip for changed-state slides.
