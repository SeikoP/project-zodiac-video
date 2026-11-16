# Ma Kết: visual audit and validation repair

The original `fix/phase02-asset-repair-routing` branch had uncommitted implementation and test work. That work was preserved, checked and synchronized to `main` in `b01a4cc1`. Its focused checks passed; the repository-wide suite was already failing in the original `59a56d7b` baseline.

## Confirmed defects

- All six original Scene Accent drawings were idea-summary badges rather than contextual details. Their old checks verified category, placement and visibility, not what the drawings communicated.
- An absent Phase-1 Narrative Visual list was automatically interpreted as an editorial omission. The Web guidance did not require the explicit decision that Local needed.
- The empty-list path could return PASS even for an unsupported Narrative Plan version.
- The approval receipt helper could bind incomplete inputs without running validation. An approval request must never waive missing inputs, failed checks or incomplete phase steps.

## Changes

Phase-1 export/import, fresh Phase-2 entry, authoring writes, progressive preflight and presence validation now reject missing visual decisions. Deliberate omission remains possible with an explicit approved rationale. Local preserves that rationale rather than replacing it.

Scene Accents require concrete setting/detail declarations, an exact narration anchor and rear layering. These are mechanical checks: the actual drawing must still be inspected. A plausible declaration cannot prove image meaning.

Approval receipt creation validates required source files, narration performance, visual decisions, episode scope and Voice Profile. Phase 2 additionally requires IN_REVIEW, current content binding, strict state/receipt validation, current projections, preflight, completeness, Narrative Visual presence, preview validity, scene experience and resolved composition. Source changes during validation block approval. The Web and Local instructions define “chốt” as validation → repair → validation; unresolved defects block transition.

## Review artifacts

Local artifacts are under `.runtime/reviews/capricorn-20261117/`:

- `merge-demos.html`: three interactive before/after experiments combining narrative imagery and Story Text. The user responded “rất ổn”; this is feedback on the demonstrated direction, not a fabricated phase approval. Production's mutually exclusive layer rule remains in force pending an intentional integration change.
- `story-text-draft.jpg`: revised S02/S04/S05/S06 with authored lettering, exact reveal anchors and outlined SVG text. S04 changes its phrase at the third refusal.
- `draft-with-story-text/`: canonical draft intent, derived projections, assets and native endpoint HTML; 12 scene endpoints and 27 event pairs. Narration bytes are unchanged.
- `phase1-visual-decision-proposal.json`: concrete proposed omission rationale, separate from the approved plan.
- `audit.json`, native gate outputs and test logs: reproducible evidence and limitations.

The original source package remains BLOCKED. Draft previews are diagnostic; no new phase approval, Job@5 delivery or rendered-media acceptance is claimed.

## Validation

- Focused final batch: **156/156 passed**.
- Broad suite: **817 tests, 772 passed, 45 failed**. All 45 failing names also failed in the original main baseline. One additional approval regression subsequently passed in the focused batch.
- Native draft preview: **27 event pairs, 54 event frames, 12 scene frames** validated.
- Actual phone-size screenshots were inspected; the original 23 event pairs were reviewed, followed by the revised lettering surfaces. Audio-aligned timing and Remotion/MP4 were not tested.
- Local development bundle passes static import closure and ZIP integrity checks. Both enabled Local cache locations received the same 505 verified development files, and the Web cache received 23 files, with backups. The shared visual contract stays dependency-free in the lightweight Web bundle. Distribution checks passed 6/6 and the post-split contract checks passed 36/36. No public release is authorized by this audit.
