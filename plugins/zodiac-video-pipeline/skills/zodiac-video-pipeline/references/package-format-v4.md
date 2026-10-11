# Zodiac job package v4 — local-runner exact package contract

Format: `zodiac-job@4`. Runtime pin: `zodiac-remotion@1.21.0`.

## Delivery filename
The delivered ZIP name is part of the handoff contract.

- First approved delivery: `zodiac-<sign>-<concept>.zip`
- Patch/re-export only: `zodiac-<sign>-<concept>-v<patch-version>.zip`
- `<sign>` is compact ASCII lowercase with no separators (`Bọ Cạp` → `bocap`).
- `<concept>` is ASCII lowercase kebab-case (`Hai phiên bản` → `hai-phien-ban`).
- Do not use `zodiac-job.zip` as a delivered filename.

## Exact ZIP root shape
The ZIP contains package files **directly at ZIP root**; wrapper folders are invalid.

Allowed entries are exactly:
- `package-manifest.json`
- `production.json`
- `narration.txt`
- `design.md`
- `assets/**` (at least one referenced SVG)
- `publish/publish.json`
- `publish/publish-copy.txt`

No other root file/folder is allowed. `.authoring/**`, renderer/library/references/node_modules/runtime/out files, runtime receipts, debug files, macOS metadata, nested ZIPs and series trackers are forbidden inside the job ZIP.

```json
{"format":"zodiac-job@4","production_contract":"2.0","runtime":{"id":"zodiac-remotion","version":"1.21.0"},"producer":{"plugin":"zodiac-video-pipeline","version":"1.58.0"}}
```

Before Handoff, every asset must already have explicit supported lineage (`mode`, `source_library`, `source_master`, `semantic_intent`) and any authored `style_id` must match the design token. A supplied transition must name an existing transition preset and use a non-negative integer duration; Handoff does not silently repair these errors.

`production.json` carries the runtime presentation contract in addition to ordinary visual data. Caption typography includes the exact demo CSS stack `"Patrick Hand", "Segoe Print", cursive`; `visual_system.brand_overlay` carries the runtime-owned `✦ bungmoto` watermark and keeps it below subtitle layer 40. The watermark is not an `assets/**` file.

Character Assembly, Visual Grammar and environment composition are authoring-only; runtime receives baked ordinary entities/assets. The final runtime scene retains a 24–30 frame landing hold.

## Export/QC boundary
Export is internal and deterministic. Resolve the canonical delivery filename from the approved sign/concept before writing bytes. Paths are NFC-normalized POSIX paths and collision-free under Windows case-folding. Reopen the final ZIP and require the expected canonical filename, valid central/local headers, CRC and uncompressed sizes, exact file-set parity and byte-for-byte parity with the validated workspace. Only `LOCAL_RUNNER_IMPORT_READY` satisfies `zip_ready`.
