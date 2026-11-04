# Phase 2 — current visual authoring

The JSON manifest owns required capabilities and native gates. Read the approved
handoff context; preserve exact narration, scope and genuine Content Review.

1. Select current components through `references/asset-library-v4/selection-guide.md`.
   Render `features/asset-selection/build-current-asset-review.mjs` when comparing
   choices. It uses native compiler output and exact masters, not episode examples.
2. Author **one source of truth only**: `.authoring/visual-intent.json` (`zodiac-visual-intent@1`). Put the semantic choices there: Scene Plan, cast identity, scene goals/grammar, context/background decision, physical-prop participation, Narrative Visual decision/entities, director beats, art-direction coverage and scene events. Character identity is fixed across states. Use performed actions to plan state assets before generation; never create duplicates then merge finished SVGs.
   Then run `write-phase02-authoring.mjs`. `compile-visual-intent.mjs` must project the intent deterministically into `production.json`, `asset-plan.json`, `visual-grammar-plan.json`, Character Assembly, Director Plan, Art Direction, Episode Cast Plan and any supported compatibility projection. These projection files are compiler-owned and must not be manually authored or patched by the agent.
3. Run native compilers and manifest validators. Fresh production uses a simple
   canvas background, independently positioned characters, optional canvas-native
   Scene Accents, Narrative Visuals, physical props and effects. Do not select,
   compile or constrain actors inside Scene Sets or walls. Preserve canvas,
   caption and real physical-contact safety. Historical Scene Set imports remain
   a separate compatibility execution path.
4. Validate actual scene events, state transitions, source/identity, token,
   contact/lifecycle, visual quality and Director choreography. Keep supported
   conditional meme work. A static hold may be justified; motion cannot substitute
   for a semantic payoff.
5. Compile every scene plus two endpoints per authored event; run native preview
   checks and `prepare-phase02-review.mjs`. Inspect all compiled visuals and secure
   explicit Visual Review. Native PASS is structural, not creative or media PASS.
6. Preserve Publish Prep and cover identity. Phase 2 creates no ZIP. Phase 3 owns
   Job@5 export; local runner owns voice, measured timing, final motion/render and
   audio/MP4 QA.

Fresh Narrative Visual authoring follows `references/narrative-visual-contract.md`
(the legacy filename is retained for existing links). The authoring role is
`narrative_visual`, not a prop; it may have one state or narrated transitions.
Effects and Scene Accents are optional and never fill space automatically.
Fresh runs also follow `references/narrative-visual-authoring.md`: a brief before drawing, a kit lint, and an optional blind readback.

Retired capabilities are unavailable in the current plugin. Restore an exact,
separately pinned snapshot to resume an approved historical job; do not use
`legacy` or `selected_cues` to bypass current selection. An asset retirement or
compiler change invalidates dependent cache/preview hashes before reuse.

Before any native asset compilation, bind every Episode Cast `role=member` character to `zodiac-glyph-shirt` with `zodiac_sign_id=member_id` **inside Visual Intent**; then `write-phase02-authoring.mjs` projects the derived files, `validate-phase02-authoring-completeness.mjs` must PASS, and per-beat `visual_coverage` is verified from the projected Art Direction; see orchestration/scene-art-direction.md. The native seam requires every layer to be selected or explicitly omitted, with actual entity/state/event coverage. Ordinary narrative props and physical support must be considered separately from Narrative Visuals.

## Mandatory storytelling readiness for fresh Phase 2

Before `visual_compile` can commit, run `features/visual-composition/validate-narrative-visual-presence.mjs <workspace>` as a required gate. A declared `narrative_visual_decision.mode=required` must have genuine scene entities with safe authored SVG assets, narration-grounded transitions, an authored narrative brief and an explicit `visual_coverage.narrative_visual=use` selection. Proposal files by themselves do not count. Fail closed on absent SVGs, missing briefs or mismatched roles; never invent a Visual Review approval. This gate checks actual presence and provenance, not whether the image succeeds editorially. Reviewers must inspect the **scene after** snapshots and event endpoints, not just scene entry frames where a visual may intentionally be hidden. Canvas accents are separate environmental depth cues, never enclosing Scene Sets or physical supports. The licensed runtime `story_object` projection of fresh `narrative_visual` must be accepted by composition validators, without relabeling an accent as a story object.
