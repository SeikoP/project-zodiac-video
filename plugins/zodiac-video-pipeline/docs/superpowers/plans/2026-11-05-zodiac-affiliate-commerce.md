# Zodiac Affiliate Commerce Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional Kalodata-backed Affiliate commerce extension to fresh Zodiac episodes while preserving the existing Job@5 renderer boundary.

**Architecture:** Commerce is a pre-Content-Review / pre-Visual-Review extension, not a fourth editorial phase. Product raster media is localized and wrapped in deterministic SVG transport assets so existing Job@5 and renderer contracts remain stable. Commerce metadata stays under `.authoring/commerce` and outside the ZIP.

**Tech Stack:** Node.js ESM, `node:test`, existing Zodiac visual/Job@5 contracts, Kalodata Open Center HTTP API.

**Spec:** `docs/superpowers/specs/2026-11-05-zodiac-affiliate-commerce-design.md`

## Global Constraints

- Ask exactly `Thêm quảng cáo Affiliate? YES/NO` before commerce work on a fresh episode.
- `NO` must not call Kalodata or create commerce assets.
- Kalodata is the only V1 product provider; never ask for a product link.
- Product media must be localized before Visual Review and must not introduce remote runtime dependencies.
- Keep Job@5 exact package shape and existing renderer version unchanged.
- Never treat Kalodata affiliate market data as proof of creator-account attachability.

## Review Focus

- Missing/invalid `KALODATA_API_KEY` fails closed with no provider fallback.
- Weak-story-fit/high-commission candidates do not outrank strong story-fit products.
- PNG/JPEG/WebP byte parsing rejects unsupported or malformed media and produces deterministic local SVG transport.
- Commerce photographic SVGs bypass human-stroke validation only with strict provenance; ordinary assets remain fully style-locked.
- Repeated topology × treatment pairs trigger review from persisted motif history.

---

### Task 1: Monetization and Kalodata product core

**Files:**
- Create: `skills/zodiac-video-pipeline/features/commerce/commerce-core.mjs`
- Create: `skills/zodiac-video-pipeline/features/commerce/kalodata-client.mjs`
- Create: `skills/zodiac-video-pipeline/features/commerce/monetization-gate.mjs`
- Test: `skills/zodiac-video-pipeline/features/commerce/tests/commerce-core.test.mjs`

**Interfaces:**
- Consumes: explicit YES/NO, story-derived keywords, `KALODATA_API_KEY`.
- Produces: canonical monetization state and normalized/ranked product candidates.

- [x] Write failing tests for gate, Kalodata request contract and ranking.
- [x] Implement minimal product core and HTTP client.
- [x] Run targeted tests and confirm PASS.

### Task 2: Product selection and creator handoff

**Files:**
- Create: `skills/zodiac-video-pipeline/features/commerce/write-product-selection.mjs`
- Test: `skills/zodiac-video-pipeline/features/commerce/tests/product-selection.test.mjs`

**Interfaces:**
- Consumes: one selected Kalodata product plus creative scores.
- Produces: `.authoring/commerce/product-selection.json` and `affiliate-handoff.json`.

- [x] Write failing persistence/handoff test.
- [x] Implement deterministic writer.
- [x] Verify no direct TikTok URL is required.

### Task 3: Product media adapter and transport safety

**Files:**
- Create: `skills/zodiac-video-pipeline/features/commerce/product-media-adapter.mjs`
- Create: `skills/zodiac-video-pipeline/features/commerce/validate-product-transport.mjs`
- Modify: `skills/zodiac-video-pipeline/references/asset-library-v4/validation/validate-production-style.mjs`
- Test: commerce core + transport/style routing tests.

**Interfaces:**
- Consumes: Kalodata product detail image URLs.
- Produces: original localized raster provenance plus `assets/product/*.svg` deterministic transport and Visual Intent asset metadata.

- [x] Write failing PNG transport test.
- [x] Implement raster localization and deterministic SVG wrapper.
- [x] Add JPEG/WebP byte parser tests and repair VP8L dimensions.
- [x] Add strict commerce transport validator.
- [x] Add production-style exception only for validated Kalodata product transport.

### Task 4: Integration validation and motif diversity

**Files:**
- Create: `skills/zodiac-video-pipeline/features/commerce/validate-affiliate-integration.mjs`
- Create: `skills/zodiac-video-pipeline/features/commerce/commerce-history.mjs`
- Test: workspace + motif-history tests.

**Interfaces:**
- Consumes: selected product, media manifest, topology × treatment plan and compact history.
- Produces: PASS/REVIEW/BLOCKED commerce verdict.

- [x] Require story anchors, product assets, typed claims, adaptive 5–18s duration and return mechanism.
- [x] Persist compact motif history.
- [x] Return REVIEW on repeated recent motif pairs without a reason.

### Task 5: Plugin routing and operator contract

**Files:**
- Modify: `plugin.json`
- Modify: `.codex-plugin/plugin.json`
- Modify: `skills/zodiac-video-pipeline/bootstrap/capabilities.json`
- Create: `skills/zodiac-affiliate-commerce/SKILL.md`
- Create: `skills/zodiac-video-pipeline/references/affiliate-commerce.md`
- Test: `orchestration/tests/affiliate-commerce-v270.test.mjs`

**Interfaces:**
- Consumes: fresh Zodiac episode routing.
- Produces: explicit commerce preflight and phase-bound commerce guidance.

- [x] Bump plugin to `2.7.0` while preserving prior prompt behavior.
- [x] Route Kalodata commerce through the optional affiliate skill.
- [x] Bind commerce capability to Phase 01 narration and Phase 02 visual work.
- [x] Keep NO path inert and existing core skill untouched.

### Task 6: Package verification and account update

**Files:**
- Package all changed/new overlay files only.

**Interfaces:**
- Consumes: current release ID `pluginrel_6aec8717111481919ea6f0e8748fb78f`.
- Produces: a new private plugin release with the same backend plugin identity.

- [ ] Run all commerce/routing targeted tests together.
- [ ] Parse manifests/JSON and run `node --check` on changed `.mjs` files.
- [ ] Inspect archive layout and ensure no credentials/temp outputs are included.
- [ ] Update plugin with optimistic release guard.
- [ ] Read back new release/version and key changed files.
