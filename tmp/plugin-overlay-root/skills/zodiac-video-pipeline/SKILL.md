---
name: zodiac-video-pipeline
description: Use when building Vietnamese Zodiac sticker-story videos through evidence, approved-content refresh, narration, visual compile, semantic assets, validation, publish packaging, cover rendering, and optional ZIP export.
---

# Zodiac Video Pipeline

## Core boundary
Local runtime owns the trusted shared Remotion renderer, its npm dependencies/tests, TTS, measured timing, render-props, MP4, rendered cover still and final publish bundle. Creative packages own narration, production/used assets, canonical design, package/runtime reference, structured handoff, receipts and publish metadata/copy. New packages are data-only zodiac-job@3 ZIPs and MUST NOT embed renderer/**, library/**, references/** or node_modules/**. Preserve approved insight/evidence. Rewrite approved narration only when explicitly requested.

## Approved-content refresh
When improving approved content, read `references/content-refresh.md`. Use selected Viral/analysis tooling and Exa when requested. If an explicitly selected helper capability is unavailable, STOP that phase and ask the user to load/reconnect it. Never silently substitute another provider.

## Phase 4 — Visual Compile
Use the full 1080×1920 canvas for story visuals. Captions are a transparent collision-aware overlay. Visual Progression Proxy: max 15 normalized narration words between meaningful non-camera state changes; local measured gate: max 5.0 seconds.

## Phase 5 — Canonical semantic asset production
Canonical library: `references/asset-library-v3/` **v3.3**. Read `asset-library-v3/README.md`, `semantic-derivation.md`, `anatomy-contract.md`, and the canonical `manifest.json`.

### One library, no parallel asset systems
Dark/thief/mystery assets are normal entries in the same canonical manifest and use the same `zodiac-paper-doodle-meme-v3` token. Curated kits are only selection helpers; they do not form separate asset libraries.

### Master boundary
A master stores **identity + reusable geometry + semantic anatomy**, never a catalog of story states. Do not add reusable files named after outcomes such as `*-open`, `*-closed`, `*-holding`, `*-angry`, `*-lamp-on`, etc. Derive the story-required state into package-owned `assets/**` for the current beat.

For every visual beat:
1. choose the closest canonical master by identity/function;
2. infer state/action from narration, not from filenames;
3. inspect anatomy/affordance hints;
4. preserve identity/structural groups;
5. derive only the semantic parts needed by the beat;
6. write package-owned assets and record lineage;
7. bind meaningful motion to the changing mechanism.

### Mechanism animation
The renderer does not directly manipulate an internal `<g>` rendered through `<Img>`. When part-level movement matters, extract/derive moving group(s) as package-owned **child entities** and animate those entities. This applies to character arms/props, lids/flaps/doors, pages, drawers, curtains, notification cards, lights and scene mechanisms.

Mechanical events must satisfy the **Semantic Animation Gate** in the renderer contract. Strong articulation actions such as open/close/fold/unfold/zip/unzip/door/drawer/lid/flap/insert/remove/hold/release/pick/place may not use an unexplained whole-asset swap.

### Legacy quarantine — mandatory
The following reference roots are physically retained only for backward compatibility and are **FORBIDDEN for new production derivation**:
- `references/asset-library-v2/`
- `references/paper-doodle-style-assets/`
- `references/chibi-human-story-assets/`
- `references/chibi-meme-style-assets/`

Do not direct-copy, derive from, cite as lineage source, or prefer these paths. If old examples point there, resolve the equivalent canonical v3.3 master instead. `manifest.json` is the authoritative asset inventory.

## Phase 6 — Publish package
Read `references/publish-package.md`. Required human-facing text lives in exactly `publish/publish-copy.txt`; machine-readable data lives in `publish/publish.json`.

### Cover Identity Gate
`publish.json.cover.identity` MUST include `sign_id`, `label`, and `glyph`; `cover.hook` MUST be non-empty. Canonical layout is `tilted_top_hook`.

## Package Compatibility Gate — mandatory before ZIP export
This gate is authoritative for package handoff. New exports use **zodiac-job@3**.

1. **Canonical narration serialization**: write `narration.txt` exactly as `"\n".join(scene["voice"] for scene in production["scenes"])`; inject no blank separator and no final LF.
2. **Thin manifest**: write `package-manifest.json` with `format="zodiac-job@3"`, `production_contract="2.0"`, producer plugin version, matching design id/version/source hash, and exact runtime ref `zodiac-remotion@1.14.0` / `88f845a0e9304383ed6627127206185d301ba1516b1e16e591cbe1ba47c3d1f8`. Never substitute “latest”.
3. **Structured handoff**: `handoff-manifest.json` remains required and declares `LOCAL_RUNTIME_PENDING` or `RENDER_READY`.
4. **Caption/design lock**: `production.caption_style` equals `design.md` caption emphasis + safe zone; Patrick Hand overlay remains transparent.
5. **Production/semantic gate**: assets, anchors, state chains, visual progression, semantic lineage and Semantic Animation Gate must pass.
6. **Package diet**: include only assets actually referenced by `production.assets`. Do not export `renderer/**`, reusable `library/**`, authoring `references/**`, or `node_modules/**`.
7. **Receipt integrity**: `FINAL_VALIDATION.json` may set PASS only after the same narration/design/handoff/semantic/thin-package gates pass.

Read `references/package-format-v3.md` before assembling the ZIP. If any gate fails, repair the data package first.

## Renderer/output gate
Do **not** copy `templates/remotion-renderer/` into a zodiac-job@3 ZIP. The template is the source for the versioned shared runtime release only. Zodiac Studio resolves the exact pinned runtime, reuses its dependencies/check cache across jobs, supplies job data through render props and uses the job root as Remotion public assets. A full local render writes `out/zodiac-story.mp4`, `cover.png`, `publish-copy.txt`, and `publish.json`; Studio then creates `zodiac-publish-bundle.zip`.
