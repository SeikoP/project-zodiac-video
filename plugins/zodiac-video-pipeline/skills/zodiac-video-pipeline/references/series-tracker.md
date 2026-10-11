# Series Tracker Contract — v1.1

Accepted format: `zodiac-series-checklist@1`.

## Purpose
The tracker is a lightweight 12-sign completion ledger. It answers only: what is done, what remains, what short concept territory has already been used, and which sign should this run produce next.

It is **not** a continuity snapshot, prior creative package, writer context, evidence source, or reason to skip fresh research.

## Bootstrap rules
- Recognize by `format`, not filename.
- Set `flags.series_tracker=true`. A tracker does not switch `run_mode` to continuity; keep `run_mode=fresh` unless the user separately asked to resume/reuse a prior creative artifact.
- Validate `signs` as 12 unique Zodiac IDs with `status` in `done|todo`.
- A user-explicit sign wins when it is `todo`; set `flags.series_auto_select=false`. Re-doing a `done` sign requires an explicit redo request.
- If no sign is explicit, set `flags.series_auto_select=true`. Before choosing, write `.authoring/series-candidate-screen.json` covering **every** `todo` sign. Each row contains a provisional one-line territory and 1–5 editorial scores for `sign_specificity`, `novelty`, `sticker_story_potential`, and `completed_overlap_risk`, with a concise rationale. The screen must identify a top-2/3 shortlist.
- Candidate-screen territories are hypotheses for selection only. They are not evidence, cannot supply wording/scenes, and are forbidden after Evidence.
- Exa discovery scouts the shortlist. Resolve the winner only after reviewing that scout; then Parallel verifies the winner's central claim. Do not state that a sign has the “best current potential” without the all-todo screen.
- If no `todo` remains, stop with `SERIES_COMPLETE` rather than inventing another sign.

## Context minimization
Write `.authoring/series-selection.json` with only:
- `selected_sign_id`, label and glyph;
- `done_sign_ids`;
- `todo_sign_ids` after selection;
- short `completed_concept_history` for anti-duplication;
- `source_format: zodiac-series-checklist@1`.

The raw tracker is classified as `series_tracker_raw` and is forbidden from creative steps. `series-candidate-screen` is allowed only in Evidence. Only final `series_selection` may enter Evidence/Concept. Narration, Visual Production, and asset generation must not receive tracker history or candidate-screen hypotheses.

Completed concepts can constrain repetition, but never donate wording, jokes, scenes, claims, evidence, cast, or assets to the new sign.

## Completion update
Only after Handoff Validate PASS **and** `zodiac-job.zip` is verified ZIP_READY:
1. mark the selected sign `done`;
2. store a short concept summary, not full narration;
3. recalculate `progress.done`, `remaining`, and `completion_percent`;
4. update `last_updated`;
5. emit the updated tracker as a separate `zodiac-series-checklist.json` next to the ZIP, never inside it.

Do not mark `done` at Content Review or Visual Review alone.
