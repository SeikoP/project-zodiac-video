# Zodiac Thin Package v3 — Runtime Registry Specification

Status: implementation target  
Package format: `zodiac-job@3`  
Current semantic runtime: `zodiac-remotion@1.15.0` (1.14.0 remains supported and immutable)

## 1. Goal

Separate per-video creative data from reusable executable renderer/runtime files.

A v3 package is a **data-only handoff**. It MUST NOT ship executable renderer source, the reusable asset library, or authoring references. Zodiac Studio resolves the exact pinned runtime locally.

## 2. Package boundary

Required creative files:

```text
package-manifest.json
production.json
narration.txt
design.md
handoff-manifest.json
assets/**
publish/publish.json
publish/publish-copy.txt
FINAL_VALIDATION.json        # required by semantic runtime 1.15+
README.md                     # optional human-facing handoff
```

Forbidden in a thin v3 package:

```text
.authoring/**
renderer/**
library/**
references/**
node_modules/**
```

Every file below `assets/**` MUST be referenced by `production.assets`. The package may not carry an entire reusable library “just in case”.

## 3. package-manifest.json

```json
{
  "format": "zodiac-job@3",
  "production_contract": "2.0",
  "runtime": {
    "id": "zodiac-remotion",
    "version": "1.15.0",
    "sha256": "<canonical runtime tree hash>"
  },
  "design": {
    "id": "zodiac-paper-doodle-meme-v3",
    "version": "3.1",
    "sha256": "<design token source_hash>"
  },
  "producer": {
    "plugin": "zodiac-video-pipeline",
    "version": "1.19.1"
  }
}
```

`runtime.sha256` pins the exact renderer tree. Studio MUST NOT replace it with “latest”.

`design.sha256` MUST equal `production.visual_system.style_token.source_hash` and the hash derived from the marked token in `design.md`.

## 4. Runtime registry

Bundled source-of-truth:

```text
runtime/
└─ zodiac-remotion/
   ├─ 1.14.0/              # immutable compatibility baseline
   │  ├─ runtime-manifest.json
   │  └─ renderer/**
   └─ 1.15.0/              # current semantic runtime
      ├─ runtime-manifest.json
      └─ renderer/**
```

Workspace cache:

```text
.zodiac-work/
├─ runtimes/
│  └─ zodiac-remotion/
│     ├─ 1.14.0/
│     └─ 1.15.0/
│        ├─ runtime-manifest.json
│        ├─ renderer/**
│        └─ renderer/node_modules/**
└─ jobs/**
```

On first use Studio copies the bundled pinned runtime into the workspace registry. Later jobs with the same runtime reuse that directory and its installed dependencies.

Runtime integrity is calculated from canonical `renderer/**` files, excluding mutable/generated directories such as `node_modules`, `.cache`, and generated runtime output.

## 5. Shared renderer data contract

The v3 renderer MUST NOT import `../../production.json` or `../../publish/publish.json` from its own source tree.

Studio invokes the shared renderer with:

- `ZODIAC_PACKAGE_ROOT=<absolute job root>`;
- an absolute render props file containing measured timing, resolved events, `production`, and `publish`;
- the job root as Remotion `--public-dir`.

Therefore:

- `staticFile("voice.wav")` resolves from the job;
- `staticFile(asset.path)` resolves from the job's `assets/**`;
- procedural SFX are generated into `.runtime/sfx/**`;
- renderer source and npm dependencies remain shared.

## 6. Compatibility

### Legacy package v2

No `package-manifest.json`:
- package-local `renderer/**` remains required;
- existing compatibility repair remains allowed;
- behavior is unchanged.

### Thin package v3

Has `package-manifest.json` with `format=zodiac-job@3`:
- package-local `renderer/**` is forbidden;
- exact runtime reference is mandatory;
- shared canonical runtime is used;
- Studio never mutates canonical bundled runtime files.

## 7. Stable failure codes

- `PACKAGE_MANIFEST_INVALID`: malformed or inconsistent v3 manifest.
- `PACKAGE_V3_BLOAT`: forbidden `.authoring`/runtime/library/reference files or unreferenced assets are present.
- `ASSET_LINEAGE_INVALID`: semantic-runtime package asset provenance is missing or invalid.
- `SEMANTIC_ANIMATION_GATE`: a mechanical event has no valid child-entity/whole-asset mechanism.
- `FINAL_VALIDATION_STALE`: the semantic/interaction receipt is absent, incomplete, or does not match the current production SHA-256.
- `RUNTIME_MISSING`: requested runtime id/version is unavailable.
- `RUNTIME_HASH_MISMATCH`: requested, bundled, or cached runtime hash does not match.
- existing package/renderer/timing errors remain unchanged for legacy packages.

## 8. Caching / invalidation

For v3:
- npm install is runtime-scoped, not job-scoped;
- renderer contract tests + TypeScript are runtime-scoped;
- creative/render fingerprints include the pinned runtime hash;
- changing publish copy must not alter the video renderer fingerprint;
- changing runtime version/hash invalidates render/checks but keeps valid voice/timing;
- changing narration continues to invalidate TTS/alignment according to existing scene logic.

## 9. Security boundary

A v3 ZIP contains data only. Executable Node.js comes only from a trusted runtime bundled with Zodiac Studio.

ZIP safety checks still reject traversal, links, duplicate paths, oversized files, and suspicious compression ratios.

## 10. Migration / rollout

1. Add v3 manifest parser + runtime registry while retaining legacy v2.
2. Keep `zodiac-remotion@1.14.0` immutable for existing packages and ship `zodiac-remotion@1.15.0` for semantic lineage/mechanism packages.
3. Make Studio resolve renderer roots through the registry for v3.
4. Update the plugin to emit v3 thin packages by default and stop copying `renderer/**`, `library/**`, and `references/**`.
5. Keep v2 import/render tests permanently.
6. Portable runtime snapshots are a future explicit export mode, not the default package.

## 11. Acceptance criteria

- legacy v2 package still validates and renders through package-local renderer;
- v3 package validates without `renderer/**`;
- v3 package containing `.authoring/**`, `renderer/**`, `library/**`, or `references/**` is rejected;
- runtime hash mismatch is rejected without latest-version fallback;
- two v3 jobs using the same runtime resolve to one workspace runtime directory;
- shared renderer does not import job JSON from relative source paths;
- runtime uses the job root as public media directory;
- all repo tests and renderer smoke CI pass.


## Semantic runtime 1.15 extension

Packages pinned to `zodiac-remotion@1.15.0` add two production-level contracts without changing `production.version=2.0`:

- every production SVG asset carries canonical v3 lineage (`mode`, `source_library`, `source_master`, `semantic_intent`, optional mutated/preserved groups);
- mechanical events declare `mechanism.mode=child_entities` with real scene entity IDs, or a justified `whole_asset` mode for non-strong rigid/information transitions.

Strong articulation actions such as open/close/fold/zip/insert/remove/pick/place/hold/release/door/drawer/lid/flap may not use `whole_asset`.

Interaction planning remains authoring-time only. `.authoring/interaction-plan.json` is validated before export and never ships in the ZIP. The package instead carries a fresh `FINAL_VALIDATION.json` whose `production_sha256` must match the current `production.json`, with `asset_lineage=PASS`, `semantic_animation_gate=PASS`, and `interaction_choreography=PASS|NOT_APPLICABLE`.

Runtime 1.15 does not auto-upgrade 1.14 packages and Studio never falls back to a different runtime version.
