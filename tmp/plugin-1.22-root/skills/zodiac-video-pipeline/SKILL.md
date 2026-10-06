---
name: zodiac-video-pipeline
description: Use when building Vietnamese Zodiac sticker-story videos through evidence, approved-content refresh, narration, visual compile, semantic assets, validation, publish packaging, cover rendering, and optional ZIP export.
---

# Zodiac Video Pipeline

## Core boundary
Local runtime owns the trusted shared Remotion renderer, its npm dependencies/tests, TTS, measured timing, render-props, MP4, rendered cover still and final publish bundle. Creative packages own narration, production/used assets, canonical design, package/runtime reference, structured handoff, receipts and publish metadata/copy. New packages are data-only zodiac-job@3 ZIPs and MUST NOT embed .authoring/**, renderer/**, library/**, references/** or node_modules/**. Preserve approved insight/evidence. Rewrite approved narration only when explicitly requested.

## Approved-content refresh
When improving approved content, read `references/content-refresh.md`. Use selected Viral/analysis tooling and Exa when requested. If an explicitly selected helper capability is unavailable, STOP that phase and ask the user to load/reconnect it. Never silently substitute another provider.

## Narrative Decision — before Story/Narration
Read `references/content-craft.md` and `references/narrative-modes.md`.

Choose two independent dimensions:
- story shape: `character_deconstruction`, `hybrid_deconstruction`, or `micro_story`;
- delivery mode: `direct` or `conversational`.

Write the full compile-time decision to `.authoring/narrative-plan.json` using `references/narrative-plan.schema.json`. Keep evidence mapping here, outside the writer prompt. Humor may change framing/dialogue/staging but MUST NOT add unsupported motive, cause, consequence, frequency, outcome, or psychological explanation.

For current Conversational work, use `audience_vibe=student_peer` unless the user explicitly requests another audience vibe.

## Phase 3 — Narration: narrator performance first
Read `references/phase3-narrator-performance.md`.

Before invoking the narration writer, compile the full plan into the minimal format in `references/phase3-writer-brief.md`.

**Critical context rule:** the Phase 3 writer receives only:
- the Phase3WriterBrief;
- the minimum approved evidence wording needed to preserve claim boundaries;
- an explicitly supplied reference transcript only for delivery mechanics when relevant.

Do NOT give the Phase 3 writer:
- the full narrative-plan beat table;
- devices/progression/QC checklists;
- asset library or interaction implementation details;
- production schema/runtime/package rules;
- exact beat quotas.

For Conversational delivery:
- topic/sign appears immediately or within the opening;
- narrator behaves like a participant/observer in the telling, not an analyst outside it;
- action/dialogue should carry the insight before explanation does;
- after a micro-scene proves a point, reframe at most once and move on;
- secondary characters must affect the situation rather than merely supply facts;
- student-peer vibe comes from social situations and spoken dynamics, not noun substitution or forced slang;
- preserve one useful synthesis/payoff instead of explaining every scene.

After the complete narration draft exists, the planner/checker reattaches the full `.authoring/narrative-plan.json` and runs `references/validate-narrative.mjs`. Apply the post-write checks in `phase3-narrator-performance.md`, including `POST_SCENE_OVEREXPLAIN`, `RELATIONAL_SCENE_DEPTH`, narrator-performance and audience-vibe review.

If relational beats exist, re-run narrative validation with `.authoring/interaction-plan.json` after Visual Compile. Authoring narrative files are never exported in zodiac-job@3.

## Phase 4 — Visual Compile
Use the full 1080×1920 canvas for story visuals. Captions are a transparent collision-aware overlay. Visual Progression Proxy: max 15 normalized narration words between meaningful non-camera state changes; local measured gate: max 5.0 seconds.

### Interaction Choreography Gate
Animation quality alone is not enough. Any beat involving **2+ characters**, or a character acting through a shared prop toward another character, is a relational interaction and MUST be choreographed before `production.json` is finalized. If the approved narrative plan marks the beat with `interaction`, preserve its `interaction_id` through Visual Compile so narrative intent and choreography can be cross-validated.

Read `asset-library-v3/interaction-contract.md` and `asset-library-v3/interaction-map.json`. During authoring, write `.authoring/interaction-plan.json` and validate it against compiled `production.json` with `asset-library-v3/validate-interactions.mjs`. `.authoring/**` is compile-time only and MUST NOT be exported in zodiac-job@3.

Interaction rules:
- define initiator, responder(s), shared prop/attention target when present, spatial slot and intended resolution;
- stage interaction as an ordered exchange: setup → initiation → contact/focus → response → resolution as applicable;
- at least two interaction members must visibly change; do not animate several isolated entities and call that interaction;
- shared props need explicit ownership before/after; a handoff may not teleport a prop between characters;
- gaze/face orientation must converge on the partner or shared target when the beat depends on attention;
- contact actions use compatible character/prop anchors; derive arms/hands/prop placement to make contact visually legible;
- responder motion follows the initiator unless the beat is explicitly simultaneous; avoid mirrored same-frame reactions by default;
- use proximity, occlusion and side/seat/threshold slots to communicate relationship, not random placement;
- one primary interaction per beat is preferred over several weak simultaneous gestures.

## Phase 5 — Canonical semantic asset production
Canonical library: `references/asset-library-v3/` **v3.4**. Read `asset-library-v3/README.md`, `semantic-derivation.md`, `anatomy-contract.md`, `validation-contract.md`, `interaction-contract.md`, and the canonical `manifest.json`.

### One library, no parallel asset systems
Daily-life, relationship, dark/thief/mystery assets are normal entries in the same canonical manifest and use the same `zodiac-paper-doodle-meme-v3` token. Curated kits are only selection helpers; they do not form separate asset libraries.

### Master boundary
A master stores **identity + reusable geometry + semantic anatomy**, never a catalog of story states. Do not add reusable files named after outcomes such as `*-open`, `*-closed`, `*-holding`, `*-angry`, `*-lamp-on`, etc. Derive the story-required state into package-owned `assets/**` for the current beat.

For every visual beat:
1. choose the closest canonical master by identity/function;
2. infer state/action from narration, not from filenames;
3. inspect concrete `semantic_parts`, role hints and affordance hints;
4. preserve identity/structural groups;
5. derive only the semantic parts needed by the beat;
6. write package-owned assets and record lineage;
7. bind meaningful motion to the changing mechanism;
8. if another character participates, compile the interaction plan into coordinated entity states/events rather than independent gestures.

### Library validation
`manifest.json` is not allowed to promise anatomy that the SVG does not contain. Before treating a master as canonical, apply `validate-library.mjs`: every declared semantic part must resolve to an SVG element/group ID; kit IDs must resolve to the manifest; affordance hints that imply a mechanism must have supporting semantic parts. `scene_groups` must list concrete parts — `inspect_svg_groups` is forbidden in v3.4.

### Mechanism animation
The renderer does not directly manipulate an internal `<g>` rendered through `<Img>`. When part-level movement matters, extract/derive moving group(s) as package-owned **child entities** and animate those entities. This applies to character arms/props, lids/flaps/doors, pages, drawers, curtains, notification cards, lights and scene mechanisms.

Mechanical events must satisfy the **Semantic Animation Gate** in the renderer contract. Strong articulation actions such as open/close/fold/unfold/zip/unzip/door/drawer/lid/flap/insert/remove/hold/release/pick/place may not use an unexplained whole-asset swap.

### Legacy quarantine — mandatory
The following reference roots are physically retained only for backward compatibility and are **FORBIDDEN for new production derivation**:
- `references/asset-library-v2/`
- `references/paper-doodle-style-assets/`
- `references/chibi-human-story-assets/`
- `references/chibi-meme-style-assets/`

Do not direct-copy, derive from, cite as lineage source, or prefer these paths. If old examples point there, resolve the equivalent canonical v3.4 master instead. `manifest.json` is the authoritative asset inventory.

## Phase 6 — Publish package
Read `references/publish-package.md`. Required human-facing text lives in exactly `publish/publish-copy.txt`; machine-readable data lives in `publish/publish.json`.

### Cover Identity Gate
`publish.json.cover.identity` MUST include `sign_id`, `label`, and `glyph`; `cover.hook` MUST be non-empty. Canonical layout is `tilted_top_hook`.

## Package Compatibility Gate — mandatory before ZIP export
This gate is authoritative for package handoff. New exports use **zodiac-job@3**.

1. **Canonical narration serialization**: write `narration.txt` exactly as `"\n".join(scene["voice"] for scene in production["scenes"])`; inject no blank separator and no final LF.
2. **Thin manifest**: write `package-manifest.json` with `format="zodiac-job@3"`, `production_contract="2.0"`, producer plugin version, matching design id/version/source hash, and exact runtime ref `zodiac-remotion@1.15.0` / `4d52e6ca766649546482a5cdfbf879f4f19c4d3c41c07c7743cccec1a7100ffa`. Never substitute “latest”.
3. **Structured handoff**: `handoff-manifest.json` remains required and declares `LOCAL_RUNTIME_PENDING` or `RENDER_READY`.
4. **Caption/design lock**: `production.caption_style` equals `design.md` caption emphasis + safe zone; Patrick Hand overlay remains transparent.
5. **Production/semantic/interaction gate**: assets, anchors, state chains, visual progression, semantic lineage, Semantic Animation Gate and Interaction Choreography Gate must pass. If a relational beat exists, validate `.authoring/interaction-plan.json` before export.
6. **Package diet**: include only assets actually referenced by `production.assets`. Do not export `.authoring/**`, `renderer/**`, reusable `library/**`, authoring `references/**`, or `node_modules/**`.
7. **Receipt integrity**: `FINAL_VALIDATION.json` is required for runtime 1.15 packages. It may set `status=PASS` only after the same narration/design/handoff/semantic/interaction/thin-package gates pass, MUST include `asset_lineage=PASS`, `semantic_animation_gate=PASS`, `interaction_choreography=PASS|NOT_APPLICABLE`, and MUST include `production_sha256` calculated from the exact exported `production.json` bytes.

Read `references/package-format-v3.md` before assembling the ZIP. If any gate fails, repair the data package first.

## Renderer/output gate
Do **not** copy `templates/remotion-renderer/` into a zodiac-job@3 ZIP. The template is the source for the versioned shared runtime release only. Zodiac Studio resolves the exact pinned `zodiac-remotion@1.15.0` runtime, reuses its dependencies/check cache across jobs, supplies job data through render props and uses the job root as Remotion public assets. A full local render writes `out/zodiac-story.mp4`, `cover.png`, `publish-copy.txt`, and `publish.json`; Studio then creates `zodiac-publish-bundle.zip`.
