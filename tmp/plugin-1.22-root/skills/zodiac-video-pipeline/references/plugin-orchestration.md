# Capability routing, phase reuse, narrative decisions, and compact handoffs

The Zodiac pipeline owns synthesis, scope, evidence boundaries, story-shape/delivery-mode selection and phase transitions.

## Approved-content reuse route

When the user explicitly asks to reuse already-approved content and a matching package is available:
- Phase 1, 2 and/or 3 may be marked `SKIPPED_REUSED`;
- preserve approved narration exactly unless rewrite is requested;
- preserve the approved story shape and delivery mode unless delivery is the requested change;
- do not fabricate new receipts for skipped capabilities;
- start from the earliest phase the user actually wants changed.

## Phase route

| Phase | Primary work | Gate |
|---|---|---|
| 1 Evidence | Exa discovery + Parallel Search verification, unless `SKIPPED_REUSED` | evidence boundary |
| Narrative Decision | choose story shape + delivery mode; write compact authoring plan | mode fit + evidence mapping |
| 2 Story | viral-headline-writer; viral-content-analyst when required, unless `SKIPPED_REUSED` | progression without repeated facet/joke |
| 3 Narration | compile minimal Phase3WriterBrief → narrator-performance writer → human-touch review, unless exact approved narration is reused | approved narration + post-write narrative QC |
| 4 Visual Compile | compile evented contract + AssetPlan + relational interactions | caption-free progression + valid interaction plan |
| 5A Master | select/reuse/create canonical masters | master fit + style identity |
| 5B Derive | derive only required production states | lineage + self-contained paths |
| 5C Animate | bind deterministic motion to SVG groups | motion bindings resolve |
| Final ZIP | exporter after RENDER_READY, or explicit local-continuation package before Phase 5 when user requests local continuation | truthful package status |

## Narrative Decision handoff

Read `content-craft.md` and `narrative-modes.md`. Store only a compact `.authoring/narrative-plan.json`:
- selected story shape;
- selected delivery mode + short rationale;
- sign/topic;
- beat purposes;
- evidence classification/reference;
- optional delivery devices such as riff, micro_scene, narrator_reaction, contradiction, interaction;
- optional interaction ID.

This plan is not a script template and does not prescribe a fixed number/order of jokes, contradictions, scenes, or reactions.

## Phase-owned context

Phase 2 may receive the compact Narrative Decision plus evidence boundary.

Phase 3 does **not** receive the full Narrative Decision. Compile it into the minimal Phase3WriterBrief from `phase3-writer-brief.md`. Give the writer only that brief plus minimal evidence wording and reference-delivery mechanics. Keep beat taxonomy, device labels, progression bookkeeping, validation rules, assets and runtime context outside the writer prompt.

After Phase 3 returns a complete draft, the planner/checker reattaches the full narrative plan for QC.

Phase 4 receives only approved narration, compact narrative plan, visual hints, evidence boundary summary and canonical design/library/interaction contracts.

Phase 5 receives only ProductionContract, AssetPlan, VisualStyleToken, the relevant narrative beat intent, and target state/action. It does not need research or writing history.

## Visual grammar

For deconstruction shapes, a useful grammar is:

`claim → visible enactment → reaction/reframe → cut/reset`

Conversational delivery may insert a narrator reaction or contradiction punch between those moves, but it does not change the semantic evidence boundary.

## Asset production rule

`asset-library-v3/manifest.json` v3.4 is the only canonical production inventory. Curated kits are selection helpers, not parallel libraries. Legacy v2/style-reference roots are quarantined and forbidden as new lineage sources.

Reuse the nearest canonical master, derive only the required package-owned semantic state, extract moving semantic groups as child entities when articulation matters, and spend most effort on choreography/animation rather than redundant redraws.
