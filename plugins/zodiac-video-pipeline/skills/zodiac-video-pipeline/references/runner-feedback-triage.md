# After the ZIP: triaging local-runner results

This page consolidates rules already stated in `orchestration/phases/03-handoff.md`,
`orchestration/runner-parity-acceptance.md`, `orchestration/phase-ownership.md`,
`orchestration/review-creative-and-publish.md` and `references/asset-use-playbook.md`.
It adds no gate and grants no approval. The producer never runs runner commands as a
prerequisite and never mutates a released ZIP.

## Status vocabulary (never merge these)
| Status | Meaning | Owner |
| --- | --- | --- |
| `PRODUCTION_READY_ZIP` / `LOCAL_RUNNER_IMPORT_READY` | One validated Job@5 ZIP exists and can be imported | Phase 03 |
| `PASS_TECHNICAL_ONLY` | Runner media acceptance found no technical defect | Local runner |
| `PRODUCTION_READY_VIDEO` | Real runner evidence plus real user review | Runner + user |
| `NOT_VERIFIED` | Evidence missing; never read it as PASS | anyone |

## When the user brings back a runner failure
1. Read the runner's actual report or log (the runner keeps stage state in `.runtime/pipeline-state.json` and the Workbench log). If none was provided, ask for it; do not guess the cause.
2. Classify the failure by the surface that owns it, using the table. Reopen the narrowest surface that explains it.
3. Edit the approved **source workspace**, never the staged or released ZIP.
4. Run `orchestration/assess-revision-impact.mjs --before <approved> --after <revised> --output <revision-impact.json>`. `REAPPROVAL_REQUIRED` is a hard obligation for each impacted surface; `UNCHANGED_BY_SNAPSHOT` is not proof of approval.
5. Obtain a new genuine user approval for impacted surfaces, seal a new review lock, and export a new revision through `run-phase03-production.mjs` (bump `--revision`). Never overwrite a released ZIP.

## Failure → owning surface
| Symptom reported by the runner | Owning surface | Reopen |
| --- | --- | --- |
| `ALIGNMENT_MISMATCH`, wording, pronunciation, pacing | Content | Content review → visuals (voice anchors/timing change) → new ZIP. If the narration is already approved, a regenerated voice may be enough: the runner's **Tiếp tục** redoes voice and alignment without a new ZIP |
| Caption overflow or layout | Runtime-owned (`references/caption-timing.md`) | Runner/renderer issue; do not author caption pages, timestamps or word counts in the source |
| Event, state or asset lost between IR and plan (`PLAN_LINEAGE_DRIFT`) | Handoff / runner lineage guard | Check the Job@5 IR first; fix source only if the authored event is actually missing |
| Identity, outfit or pose mismatch | Phase 02 character plan | Character plan + identity/style gates + affected visual review |
| Geometry, contact, layer or effect lifecycle | Phase 02 scene direction / meme binding | Affected native compilers + previews + visual review |
| Cover or publish copy only | Phase 02 publish surface | Cover/publish files only; do not recreate character SVGs |
| Missing authored state or prop | Phase 02 authoring | The runner cannot fabricate it; author it in source |
| `DEPENDENCY_MISSING`, VieNeu or ffmpeg unavailable | Local environment | Not a producer issue; the user fixes the runner environment, no new ZIP |

## Evidence the user may still owe
Full playback, Vietnamese glyph coverage, spatial/actor semantics, last-word listening,
cover crop, dialogue pace and artifact provenance. Static tests and CI do not replace them.
