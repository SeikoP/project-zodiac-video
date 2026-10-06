# Zodiac Thin Package v4 — Local Runtime Boundary Specification

Status: current default  
Package format: `zodiac-job@4`  
Production contract: `2.0`  
Current runtime: `zodiac-remotion@1.15.0`

## 1. Goal

A v4 package is a creative handoff, not a runtime attestation. The plugin owns
creative production and authoring validation; Zodiac Studio owns the local
runtime, TTS, measured timing, rendering, and the final runtime receipt.

This removes duplicated claims such as a package-provided runtime hash or
`FINAL_VALIDATION.json` that Studio would immediately recompute.

## 2. Package boundary

Required:

```text
package-manifest.json
production.json
narration.txt
design.md
assets/**
publish/publish.json
publish/publish-copy.txt
```

Optional:

```text
README.md
```

Forbidden in the incoming creative ZIP:

```text
.authoring/**
renderer/**
library/**
references/**
node_modules/**
.runtime/**
out/**
voice.wav
FINAL_VALIDATION.json
handoff-manifest.json
```

Only assets referenced by `production.assets` may be shipped.

After import, Studio may create `.runtime/**`, `voice.wav`, and `out/**`.
Those are local job state and are not package bloat after the import boundary.

## 3. package-manifest.json

```json
{
  "format": "zodiac-job@4",
  "production_contract": "2.0",
  "runtime": {
    "id": "zodiac-remotion",
    "version": "1.15.0"
  },
  "producer": {
    "plugin": "zodiac-video-pipeline",
    "version": "<active plugin version>"
  }
}
```

V4 intentionally does not carry:
- `runtime.sha256`;
- a duplicate design hash;
- `FINAL_VALIDATION.json`;
- `handoff-manifest.json`.

Runtime version remains exact. Studio must not silently resolve another version
or a `latest` alias.

## 4. Creative validation

Studio validates directly from source artifacts:
- production contract and scene/entity/state/event continuity;
- `design.md` token against the compiled production style token;
- caption/design lock;
- SVG safety and style;
- canonical v3 asset lineage for semantic runtime packages;
- Semantic Animation Gate mechanisms;
- exact `narration.txt` serialization;
- visual progression proxy;
- referenced-assets-only boundary;
- publish metadata/cover references.

Interaction choreography remains an authoring-time plugin gate and is not shipped
as a runtime receipt.

## 5. Runtime ownership

Studio resolves `runtime.id + runtime.version` against its local registry.

The runtime's own `runtime-manifest.json` contains the canonical renderer
SHA-256. Studio verifies bundled and cached renderer trees locally. The tree hash
normalizes text line endings so LF and CRLF checkouts of identical source have the
same integrity value.

A corrupt/mismatched local runtime is a local runtime failure, not a package hash
failure.

## 6. Local workflow

After import:

```text
creative package
  -> dependency/service preflight
  -> per-scene TTS
  -> voice.wav
  -> measured word alignment
  -> .runtime/timing.json
  -> measured runtime validation
  -> renderer checks
  -> video + cover render
  -> optional music mix
  -> out/FINAL_VALIDATION.json
  -> out/zodiac-publish-bundle.zip
```

VieNeu availability is not an import requirement. It becomes blocking only when
the local workflow reaches voice/preflight work.

## 7. Final local receipt

For v4, `FINAL_VALIDATION.json` is output, never input. Studio writes it only
after the local runtime artifacts needed by the final workflow exist.

The receipt records the exact production hash and verified local runtime identity,
plus package/semantic/voice/timing/render output status. It is included in the
publish bundle, not in the incoming zodiac-job ZIP.

## 8. Compatibility

- v2 remains supported through its package-local renderer.
- v3 remains supported with its existing runtime/design SHA and package receipt
  semantics.
- v4 is the default for new creative exports.
- No format silently upgrades to another format or runtime version.

## 9. Acceptance criteria

- v4 imports without package runtime SHA, design SHA, handoff manifest, or final
  validation receipt;
- invalid lineage, semantic mechanisms, narration, design, assets or publish
  metadata still fail closed;
- incoming v4 ZIPs containing local runtime/output state are rejected;
- after import, local `.runtime/**`, `voice.wav`, and `out/**` are allowed;
- LF and CRLF renderer source produce one canonical runtime hash;
- v2/v3 regression tests stay green;
- Studio creates final validation only from actual local state;
- VieNeu polling never blocks the Tk main thread.
