# Zodiac job package v5 — canonical authoring handoff

Format: `zodiac-job@5`. Renderer pin: `zodiac-renderer@2.0.0`. Authoring contract: `zodiac-authoring-ir@1`.

## Identity
`package-manifest.json` contains stable `job.id` derived from approved sign + concept and a mutable `job.revision`. ZIP filenames may change across patches; `job.id` must not.

## Exact root shape
Allowed entries are exactly:
- `package-manifest.json`
- `production.ir.json`
- `design-token.json`
- `narration.txt`
- `assets/**`
- `publish/publish.json`
- `publish/publish-copy.txt`

`production.json`, `design.md`, `.authoring/**`, renderer/runtime files, `voice.wav`, `.runtime/**`, `out/**`, nested ZIPs and debug receipts are forbidden.

## Ownership boundary
The plugin exports semantic intent only. `production.ir.json` may contain entity states, explicit desired motion IDs, semantic triggers and scheduling policy. It must not contain resolved `start_frame` / `end_frame` or runtime performance/default fields. `design-token.json` carries v4 style intent plus deterministic duration for every desired motion used by the IR.

The local Control Plane validates the manifest contract hash against its canonical Authoring IR schema, measures timing, compiles the executable render plan, resolves overlaps and invokes Renderer 2.

## Delivery filename
First approved delivery: `zodiac-<sign>-<concept>.zip`. Patch/re-export only: `zodiac-<sign>-<concept>-v<patch-version>.zip`. Never deliver `zodiac-job.zip`.
