# Capability routing, phase reuse, narrative modes, and compact handoffs

The Zodiac pipeline owns synthesis, scope, evidence boundaries, narrative-mode selection and phase transitions.

## Approved-content reuse route

When the user explicitly asks to reuse already-approved content and a matching package is available:
- Phase 1, 2 and/or 3 may be marked `SKIPPED_REUSED`;
- preserve approved narration exactly unless rewrite is requested;
- do not fabricate new receipts for skipped capabilities;
- start from the earliest phase the user actually wants changed.

## Phase route

| Phase | Primary work | Gate |
|---|---|---|
| 1 Evidence | Exa discovery + Parallel Search verification, unless `SKIPPED_REUSED` | evidence boundary |
| Narrative Mode | select mode, unless preserved from approved package | mode + rationale |
| 2 Story | viral-headline-writer; viral-content-analyst when required, unless `SKIPPED_REUSED` | StoryCard + progression |
| 3 Narration | viral-writer → nghe-content-writer-guide → human-touch-checklist, unless exact approved narration is reused | approved narration |
| 4 Visual Compile | compile evented contract + AssetPlan using canonical design | caption-free progression + valid AssetPlan |
| 5A Master | select/reuse/create canonical masters | master fit + style identity |
| 5B Derive | derive only required production states | lineage + self-contained paths |
| 5C Animate | bind deterministic motion to SVG groups | motion bindings resolve |
| Final ZIP | exporter after RENDER_READY, or explicit local-continuation package before Phase 5 when user requests local continuation | truthful package status |

## Phase-owned context

Phase 4 receives only approved narration, narrative mode, visual hints, evidence boundary summary and canonical design/library contracts.

Phase 5 receives only ProductionContract, AssetPlan, VisualStyleToken, narrative mode, and target state/action. It does not need research or writing history.

## Visual grammar

For deconstruction modes:

`claim → doodle setup → meme reaction → paper-note reframe → cut/reset`

## Asset production rule

`asset-library-v3/manifest.json` v3.4 is the only canonical production inventory. Curated kits are selection helpers, not parallel libraries. Legacy v2/style-reference roots are quarantined and forbidden as new lineage sources.

Reuse the nearest canonical master, derive only the required package-owned semantic state, extract moving semantic groups as child entities when articulation matters, and spend most effort on choreography/animation rather than redundant redraws.
