# Phase 2 — current visual authoring

The JSON manifest owns required capabilities and native gates. Read the approved
handoff context; preserve exact narration, scope and genuine Content Review.

## Work loop

The existing manifest steps stay authoritative. Work through five responsibilities:
1. **Design:** read the approved Phase-1 `narrative_visual_direction` first. If none exists, do not invent one. When present, preserve its `trait_basis`, `story_point`, `viewer_read`, `visible_subject`, `visible_action`, `visual_idea`, concept/tone fit and optional payoff; decide only scene execution (setup/change/reaction, acting, physical props, placement and state transitions). Story Text is the mutually exclusive alternative.
2. **Author:** write Visual Intent once. Preserve identity, voice ranges and continuity; project derived files through the owning writer.
3. **Validate and compile:** run entry checks as one bounded batch before expensive assets. On failure, read the execution receipt's structured issues and source-bound repair groups, fix the owning canonical source once, and rerun the valid dirty closure. Exact cache hits require dependency and output hashes; file existence is insufficient.
4. **Inspect:** after Director/native gates, inspect scene entry/final frames and every event pair at phone size. Judge readable cause -> reaction -> payoff, hand/prop contact, lettering contrast and callbacks. A label or state name does not prove an action happened.
5. **Review:** prepare the review surface and obtain genuine Visual Review. Keep native structural results, creative approval and downstream measured media results separate.

Use the current work-unit capsule; fetch selected catalogs before using their capabilities. Do not reload full catalogs between unchanged tasks. Use `core/performance/diagnose-phase02.mjs <workspace>` for native and preview reuse metrics; agent authoring, review wait and final render time require their own recorded spans. Never infer end-to-end speed or creative quality from native timings.

1. Select reusable construction components through `references/asset-library-v4/selection-guide.md`. Every fresh scene requires a visible background/context component with actual Scene Accent entity/asset/coverage. A palette-only canvas is incomplete. Narrative Visual has **no quota**: use it only when Phase 1 supplied a concrete `narrative_visuals[]` direction, then set `narrative_visual_decision.mode=required`; otherwise set it to `omitted`. **Narrative Visual is not selected from the asset catalog**. A scene may use Narrative Visual or Story Text, never both. Runtime may serialize `narrative_visual` as Job@5 `story_object`; that is transport vocabulary only.
   Render `features/asset-selection/build-current-asset-review.mjs` only when comparing reusable character/context/physical-prop choices. Narrative Visual has no catalog or reusable symbolic variants.
2. Author **one source of truth only** in Phase 2: `.authoring/visual-intent.json` (`zodiac-visual-intent@1`). Put implementation choices there: Scene Plan, cast identity, scene goals/grammar, context/background decision, physical-prop participation, the approved Phase-1 Narrative Visual reference/entities, director beats, art-direction coverage and scene events. Narrative Visual story meaning and concrete `visual_idea` remain owned by Phase 1 and may not drift here. Character identity is fixed across states. Use performed actions to plan state assets before generation; never create duplicates then merge finished SVGs.
   Then run `write-phase02-authoring.mjs`. `compile-visual-intent.mjs` must project the intent deterministically into `production.json`, `asset-plan.json`, `visual-grammar-plan.json`, Character Assembly, Director Plan, Art Direction, Episode Cast Plan and any supported compatibility projection. These projection files are compiler-owned and must not be manually authored or patched by the agent.
   Every beat must decide `story_text`/`meme` use or omit with a reason, while Narrative Visual coverage follows the approved Phase-1 direction. Story Text and Narrative Visual are mutually exclusive for the entire scene. Follow `references/story-text.md`, `references/narrative-visual.md` and `references/visual-direction.md`; completeness blocks conflicts, missing decisions and unperformed selections.
3. Before native asset compilation, run the **progressive Phase-2 checkpoint** for fresh runs:
   - `validate-phase02-progressive-preflight.mjs` catches deterministic defects that should never wait for Director/native QC: incomplete Director beats, motion-registry duration mismatches, and authored-SVG style/handmade/stroke/palette violations.
   - `validate-scene-experience.mjs --write` writes `.authoring/scene-experience-review.json`. It reviews character action, environment specificity, physical storytelling, depth separation, secondary action, callbacks and Narrative Visual role. Every fresh scene must declare `experience_profile.story_mode`; missing profile is REVIEW. The profile is authoring-only and is stripped before production projection.
   - Behavior/relationship scenes with only a passive actor plus passive decoration remain `REVIEW`. An intentionally sparse reflection/payoff scene may PASS when its negative-space rationale is explicit. Do not satisfy the review by adding decorative assets or fixed prop quotas.
   - These checks run in the same parallel entry-preflight batch as the existing seam/character/art-direction checks. Any blocker stops before native SVG generation.

4. Run native compilers and manifest validators. Fresh production uses a simple
   canvas background, independently positioned characters, optional canvas-native
   Scene Accents, Narrative Visuals, physical props and effects. Do not select,
   compile or constrain actors inside Scene Sets or walls. Preserve canvas,
   caption and real physical-contact safety. Continuity mode may use the live Scene Set capability; fresh authoring does not.
5. Validate actual scene events, state transitions, source/identity, token,
   contact/lifecycle, visual quality and Director choreography. Keep supported
   conditional meme work. A static hold may be justified; motion cannot substitute
   for a semantic payoff.
6. Compile every scene plus two endpoints per authored event; run native preview
   checks and `prepare-phase02-review.mjs`. Inspect all compiled visuals and secure
   explicit Visual Review. Native PASS is structural, not creative or media PASS.
7. Preserve Publish Prep and cover identity. Phase 2 creates no ZIP. Phase 3 owns
   Job@5 export; local runner owns voice, measured timing, final motion/render and
   audio/MP4 QA.

Fresh Narrative Visual execution follows the single canonical `references/narrative-visual.md`. The authoring role is `narrative_visual`, never a prop or catalog symbol. Effects are optional and never fill space automatically. Scene Accent is the visible background/context component in fresh scenes.

Removed storytelling variants are not recoverable from current authoring context. Do not route fresh work through retired IDs or aliases. Compiler changes invalidate dependent cache/preview hashes before reuse.

Before any native asset compilation, bind every Episode Cast `role=member` character to `zodiac-glyph-shirt` with `zodiac_sign_id=member_id` **inside Visual Intent**; then `write-phase02-authoring.mjs` projects the derived files, `validate-phase02-authoring-completeness.mjs` must PASS, and per-beat `visual_coverage` is verified from the projected Art Direction; see orchestration/scene-art-direction.md. The native seam requires every layer to be selected or explicitly omitted, with actual entity/state/event coverage. Ordinary narrative props and physical support must be considered separately from Narrative Visuals.

## Mandatory storytelling readiness for fresh Phase 2

Before `visual_compile` can commit, run `features/visual-composition/validate-narrative-visual-presence.mjs <workspace>` as a required gate. If Phase 1 has no Narrative Visual direction, fresh intent must declare `narrative_visual_decision.mode=omitted`; Phase 2 may not invent one. If Phase 1 has a direction, `mode=required` must have genuine scene entities with safe authored SVG assets, narration-grounded transitions, an authored narrative brief, exact Phase-1 lineage and explicit coverage. Story Text in the same scene blocks. Proposal files by themselves do not count; never invent a Visual Review approval. Reviewers must inspect the **scene after** snapshots and event endpoints, not just scene entry frames where a visual may intentionally be hidden. Canvas accents are separate environmental depth cues, never enclosing Scene Sets or physical supports. The licensed runtime `story_object` projection of fresh `narrative_visual` must be accepted by composition validators, without relabeling an accent as a Narrative Visual.


## Incremental cache contract

Phase 02 computational reuse is content-addressed and dependency-aware. Never treat file existence as a cache hit. Reuse is valid only when the semantic input fingerprint, selected dependency/compiler fingerprint, referenced asset hashes, and output hashes match.

The cache lives under `.authoring/cache/`. Visual Intent remains the only fresh-run authored visual source; cache metadata and generated projections are compiler-owned.

Human Content Review and Visual Review receipts are not cache entries. Any change to a review-bound source invalidates the corresponding approval independently of whether unaffected computational nodes can be reused.

Expected invalidation:
- changing one Narrative Visual dirties that asset, its scene composition, its scene preview/event frames, and the review aggregate;
- changing character identity dirties the character asset and only scenes/previews that reference it;
- unrelated scenes/assets remain reusable;
- missing or tampered cached outputs are rebuilt;
- compiler/validator changes invalidate affected PASS entries.

Use `phase02-execute.mjs --run --no-cache` for a full rebuild comparison. Normal logs should summarize reused/rebuilt nodes and reason codes; hashes are debug detail.


## Progressive revision guidance

`core/audit/assess-revision-impact.mjs` now projects the existing Phase-2 semantic graph into scene/asset-level `rebuild` and `reuse` guidance. A single-scene prop/Narrative Visual edit dirties that scene, its preview/event endpoints and the review aggregate while unrelated scene previews and character assets remain reusable when their semantic/dependency/output hashes still match. This guidance never grants or preserves user approval by itself.
