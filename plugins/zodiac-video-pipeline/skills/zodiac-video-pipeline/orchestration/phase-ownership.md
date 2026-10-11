# Phase ownership matrix

| Phase | Owns | Must not own | Review point |
|---|---|---|---|
| Content | evidence, viral/story analysis, narrative decision, narration, narrative QC | SVG production, publish files, package, render, ZIP | Content review |
| Visual Production | semantic production intent, meme selection/binding, assets/lineage, scene direction, publish metadata/copy | package manifest, measured timing, render plan, render, ZIP | Visual review |
| Handoff | `zodiac-job@5` manifest, canonical Authoring IR/design-token compilation, workspace validation, optional single creative export | story rewrite, asset redesign, measured timing, resolved frame scheduling, runtime performance defaults, local TTS/render | Final handoff |

## Artifact ownership
- `publish/**` exists before Handoff starts; Handoff only rewrites `publish.source` to canonical job@5 paths.
- `production.json` + `design.md` are Phase-2 authoring inputs and are pruned from the delivery workspace after successful job@5 compilation.
- `production.ir.json` + `design-token.json` are Handoff-owned delivery artifacts.
- Canonical delivery ZIP: Handoff Export only, max one per run; actual filename is `zodiac-<sign>-<concept>[-v<patch-version>].zip`.
- `voice.wav`, measured `timing.json`, `render-plan.json`, video/audio outputs and runtime receipts belong to local Zodiac Studio, never the plugin ZIP.
- `zodiac-publish-bundle.zip`: retired/forbidden.
- Failed validation repairs/rebuilds the workspace; ZIP is never a checkpoint.
