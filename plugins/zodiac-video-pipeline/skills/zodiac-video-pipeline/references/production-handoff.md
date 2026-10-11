# Production Handoff — v1.58.0

VISUAL REVIEW is the final human approval. Handoff is Assemble → Validate → deterministic Export → post-ZIP QC.

Phase 2 must already have baked Character Assembly and materialized/validated environment entities. Assemble applies the final landing hold, then performs **strict** runtime production projection. Projection may remove authoring-only fields and canonicalize the supported runtime envelope, but it must not fabricate missing lineage, silently relabel style, or downgrade unknown/invalid transitions to `cut`.

Runtime projection also carries two presentation contracts that must survive unchanged into `production.json`:
- caption typography: exact demo CSS stack `"Patrick Hand", "Segoe Print", cursive`;
- runtime branding: `visual_system.brand_overlay` with canonical `✦ bungmoto` settings from `design.md`.

Before Export, resolve the delivery identity from the approved sign + concept. The first approved delivery is `zodiac-<sign>-<concept>.zip`. A patch/re-export appends `-v<patch-version>` and only then. Sign slug is compact ASCII (`Bọ Cạp` → `bocap`); concept slug is ASCII kebab-case (`Hai phiên bản` → `hai-phien-ban`).

Validate checks the loose workspace. Export uses `export-zodiac-job.mjs` with explicit `--sign` and `--concept` to create the single root-flat canonical-named ZIP, then reopens the generated artifact with the same naming inputs. `zodiac-job.zip` is not a valid delivery filename. If filename, root layout, Windows/NFC path safety, CRC/decompression, exact file-set or byte parity fails, the ZIP is removed.

`validate-zodiac-job-zip.mjs` is the final artifact gate and must emit `LOCAL_RUNNER_IMPORT_READY`. Runtime remains production 2.0 for Zodiac Studio runtime 1.21.0, 1080×1920 at 24fps.
