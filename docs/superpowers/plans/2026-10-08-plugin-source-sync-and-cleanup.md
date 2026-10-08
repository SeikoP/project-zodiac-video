# Zodiac plugin source sync and E2E hardening checkpoint

**Source plugin:** `plugins_6ac25a87d8d481919c5ef654596144e3`  
**Current version:** `2.1.5`  
**Current release:** `pluginrel_6ac7ab00992c819195425b1743a1907f`  
**Scope:** USER/PRIVATE  
**Inventory:** 244 files, 852,850 bytes (reported by Plugin Creator).  
**Destination review:** repository is PUBLIC. Do not publish full private plugin source until destination visibility is explicitly approved.

## Goal
Move editable plugin source into version control, eliminate stale/duplicated artifacts, fix verified contract and asset optimization defects, test plugin → Job@5 → runner → renderer, and only then re-import the cleaned plugin.

## Non-destructive migration
1. Export version-pinned archive of current plugin release, compare file count and SHA-256 manifest, and retain offline backup.
2. Choose private repository or explicitly approve public repo; work on a branch, never edit live plugin while making destructive cleanup.
3. Mirror source under `plugins/zodiac-video-pipeline/` preserving manifest and relative paths. Tag import baseline before refactoring.
4. Audit obsolete files using import/reference reachability, tests and compatibility; delete only with written proof and an explicit deletion list.
5. Implement fixes with failing tests, preferably in independently reviewable commits:
   - semantic-asset-fit coverage (empty decisions must fail for story objects);
   - effective total asset budget, per-character reports, justified state creation;
   - reuse identical meme effect SVG per geometry/aspect, keep per-scene entity transforms;
   - scene direction and environment binding gates;
   - conditional reference loading and token budget;
   - authoritative typography/watermark runtime smoke checks;
   - global timestamp and timeline preflight;
   - subprocess ownership, cancel/exit cleanup, cache revision;
   - CI that roundtrips Job@5 through consumer package import and PLAN.
6. Build from committed source, inspect archive path coverage, import as guarded plugin UPDATE where possible to preserve identity; do not delete active plugin or create a new plugin until replacement has been verified.
7. End-to-end run on Windows, compare rendered caption, font, watermark, visual identity, environment, animation and final audio.

## Already-existing implementations, avoid duplication
- Character Assembly default max 3 unique keyed state assets per character, `--plan-only` before write, explicit exception for >3.
- State reuse uses identity+pose+expression+crop keys (not post-hoc SVG byte deduplication).
- Current README already documents per-key reuse.

## Confirmed defect
`references/asset-library-v4/effects/compile-meme-effects.mjs` currently keys output by `scene.id + spec.id`; identical effect geometry/aspect repeated across scenes generates independent files.

## Acceptance gates
- `PLUGIN_SOURCE_SYNCED`: exact file coverage and no leaked credentials.
- `CLEANUP_SAFE`: orphan report, contract tests, rollback archive.
- `JOB5_IMPORT_READY`: import via actual StudioV2Controller.
- `PLAN_READY`: timing fixture accepted by actual timeline compiler.
- `RENDER_SMOKE_PASS`: font and watermark visible in output frames.
- `PRODUCTION_QC_APPROVED`: Windows E2E verified.

## Restrictions
- No destruction of USER/PRIVATE plugin until a tested replacement exists.
- No ZIP-only/manual baseline as canonical source after migration.
- Separate source plugin version from runner and renderer versions.
- Keep three review phases `01-content → 02-visual-production → 03-handoff`.
- Keep asset authoring and runtime performance concerns separate.
