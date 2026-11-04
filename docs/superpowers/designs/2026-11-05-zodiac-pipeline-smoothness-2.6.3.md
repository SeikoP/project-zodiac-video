# Zodiac Pipeline Smoothness 2.6.3 — Design

## Goal
Make future Phase 1/2 runs deterministic and review-first: required authoring components fail early, receipts prove the exact invocation/output lineage, fresh V4 never falls back to legacy Story Object/Scene Set behavior, and user-facing packaging happens only in Phase 3.

## Decisions
1. Phase 2 visual_compile requires a valid scene_plan in the authored Visual Intent before compilation/commit.
2. Add a Phase 2 completeness validator covering Scene Plan, Director Plan, Cast/Character Assembly, visual coverage, physical prop participation when declared, Narrative Visual decision/presence, environment/context and preview readiness.
3. Strengthen validator receipts with script SHA-256, exact argv, and declared output hashes; commit logic rejects stale or malformed receipts.
4. Fresh-mode validators fail closed on legacy Scene Set/Story Object authoring paths; compatibility remains only for non-fresh recovery.
5. Interaction policy: Phase 1 and Phase 2 never package user-download ZIPs. Show only narration/review text and review images/files. Phase 3 owns exactly one Job@5 ZIP per revision.
6. User-facing statuses remain DRAFT, IN_REVIEW, APPROVED, PASS, BLOCKED; lower-level transport/preflight states stay diagnostic.
7. Release as plugin 2.6.3 and regenerate all three phase-scoped execution bundles from the merged release commit.

## Non-goals
- No renderer/runtime change.
- No creative changes to existing approved episodes.
- No removal of legacy compatibility modules needed for historical recovery.
