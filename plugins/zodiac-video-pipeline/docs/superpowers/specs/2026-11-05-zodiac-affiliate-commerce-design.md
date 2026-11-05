# Zodiac Affiliate Commerce Design

**Date:** 2026-11-05  
**Status:** Approved for implementation by user instruction to implement  
**Scope:** Optional TikTok Shop Affiliate extension for `zodiac-video-pipeline`

## Intent

Add monetization without replacing the Zodiac story. A fresh episode first asks `Thêm quảng cáo Affiliate? YES/NO`. `NO` is a strict no-op for commerce. `YES` activates Kalodata product discovery, story-fit ranking, creative insertion, localized product media, and a creator handoff for fast TikTok search/attachment.

## Goals

- Kalodata is the only canonical product discovery/intelligence provider in V1.
- Never require or request a user-supplied TikTok Shop product link.
- Keep Story Fit above commission when selecting products.
- Make advertising creative vary by insertion topology × treatment, not a single repeated motif.
- Support 5–18s adaptive commercial exposure with an explicit return to the story.
- Use real product pixels in Visual Review and the final render without adding remote runtime dependencies.
- Preserve existing Job@5 and `zodiac-renderer@2.0.2` transport boundaries.
- Emit exact product name, seller, Kalodata product ID and TikTok search query for fast attachment.

## Non-goals

- Do not prove the creator account can attach a product from Kalodata alone.
- Do not fabricate TikTok product URLs.
- Do not add a second discovery provider in V1.
- Do not change local-runner ownership of TTS, measured timing, Remotion, audio or MP4 QA.
- Do not mutate released Job@5 ZIPs.

## Architecture

### Monetization gate

Persist `.authoring/commerce/monetization.json` using an explicit YES/NO decision. Missing decisions block commerce. When disabled, no Kalodata calls or commerce artifacts are allowed.

### Product discovery and selection

Derive multiple Vietnamese keywords from the stable base narration. Query Kalodata Open Center with `VN`, `is_affiliate=1`, `need_image=1`, and sort by video commerce performance. Normalize/deduplicate candidates by product ID. Rank with the baseline weights:

- 30% Story Fit
- 20% video revenue
- 15% sales volume
- 10% commission
- 10% visual quality
- 10% demo potential
- 5% price fit

Very weak Story Fit is disqualified even when commercial metrics are high.

### Creative integration

Choose two independent dimensions:

- Topology: `interrupt`, `embedded`, `seed_and_reveal`, `split_exposure`, `post_payoff`, `callback`.
- Treatment: `narrator_hijack`, `freeze_analysis`, `prop_zoom`, `character_demo`, `mystery_clue`, `visual_annotation`, `comparison_card`.

Each plan records story-before/story-after anchors, 5–18s commercial duration, product asset IDs, typed claims and a return mechanism. Removing the commercial section must leave the Zodiac story coherent. Compact motif history is persisted for anti-repetition; prior creative copy is never reused as history.

### Product media

Kalodata image URLs are source locators only. Before Visual Review, Product Media Adapter downloads and byte-validates PNG/JPEG/WebP, stores original bytes plus SHA-256/provenance under `.authoring/commerce/media-source/`, and creates deterministic local SVG wrappers under `assets/product/` with the raster bytes embedded as a data URI.

This **SVG transport** strategy was chosen over native raster renderer changes because the current Job@5 pipeline and renderer are SVG-native. A strict commerce transport validator permits this photographic exception only when provider, source hash, dimensions, local path and embedded MIME are valid. Remote URLs, scripts, `foreignObject`, filters, animation and `<use>` are forbidden.

Product transport assets keep an existing supported category (`story_object`, or `prop` only for a true in-world physical prop). No new Job@5 category is introduced.

### Review and handoff

Commerce narration is inserted before final Content Review. Product media is localized before Visual Review so the reviewer sees the exact pixels that will ship. Source/media changes reopen the affected review.

`affiliate-handoff.json` remains authoring-side metadata, outside the exact Job@5 ZIP. It includes product identity, seller, TikTok search query and market snapshots. `ACCOUNT_ATTACH_UNVERIFIED` remains until TikTok itself confirms attachability.

## Approaches considered

1. **Native PNG/JPEG/WebP Job@5 support** — clean long-term transport, but requires renderer/runtime and validator changes. Rejected for V1 due regression risk.
2. **Convert product image into paper-doodle artwork** — preserves style but stops showing the actual product. Rejected because the affiliate use case needs real product pixels.
3. **Deterministic raster-in-SVG transport** — preserves real pixels and the existing renderer boundary while keeping immutable local bytes. **Chosen for V1.**

## Constraints

- Kalodata API key is supplied at runtime as `KALODATA_API_KEY`; never package credentials.
- API auth uses `secret-key` header.
- Missing Kalodata access is `BLOCKED`, not a reason to silently use another provider.
- Product market data is snapshot data and cannot be treated as account-level TikTok authorization.
- Existing Zodiac Content Review, Visual Review and Phase 03 approval gates remain authoritative.
