# Visual Workstream Dependency Audit — 2026-10-12

Status: verified on `codex/zodiac-visual-semantics-palettes`.

## Compatibility surface

Thin `orchestration/*.mjs` forwarding paths remain compatibility-only. Fresh internal imports target canonical owners under `core/`, `features/`, and `phases/`.

Ruling: repository-zero-consumers is not sufficient evidence that a historical public wrapper has zero external consumers. Thin wrappers are therefore classified and retained until an explicit external deprecation gate proves deletion safe. This costs a small number of forwarding files but avoids breaking historical CLI/module callers.

Classification policy is recorded in:

`plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/compatibility-surface.json`

## Fresh context

GitHub Actions run `38286157699`:

- fresh `02-visual-production / visual_compile`: **20 refs / 69,410 bytes**;
- target: ≤70,000 bytes;
- no Story Object compatibility guidance on the fresh default path;
- Visual Metaphor remains opt-in.

## Runtime retention

Reverse-dependency audit on the same run:

`RUNTIME_AUDIT rows=12 safe_to_archive=[]`

All registered runtime versions still have references:

- zodiac-remotion 1.14.0 — 4 refs
- zodiac-remotion 1.15.0 — 6 refs
- zodiac-remotion 1.16.0 — 6 refs
- zodiac-remotion 1.17.0 — 2 refs
- zodiac-remotion 1.18.0 — 2 refs
- zodiac-remotion 1.18.1 — 2 refs
- zodiac-remotion 1.19.0 — 2 refs
- zodiac-remotion 1.19.1 — 4 refs
- zodiac-remotion 1.20.0 — 6 refs
- zodiac-remotion 1.21.0 — 10 refs
- zodiac-renderer 2.0.0 — 24 refs
- zodiac-renderer 2.0.1 — 25 refs

No runtime source version is safe to archive in this workstream.

## Verification

GitHub Actions run `38286157699`:

- targeted visual/context contract suite: **15/15 PASS**
- full plugin orchestration/reference suite: **646/646 PASS**
- Asset V4 validator: **PASS**
- Python runtime/contract/application/runner selected gate: **24/24 PASS**
- runtime audit: **12 registered versions, 0 safe to archive**
- fresh context budget: **69,410 bytes**
