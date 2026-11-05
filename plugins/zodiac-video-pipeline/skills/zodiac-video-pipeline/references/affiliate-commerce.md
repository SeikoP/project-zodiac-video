# Affiliate commerce contract — v1

## Provider decision

**Kalodata is the canonical product discovery and market-intelligence provider for V1.** Do not ask the user for a TikTok Shop product link and do not silently fall back to another product provider.

Kalodata requests use `POST` JSON against the Open Center API. Authentication is supplied through the `secret-key` header from `KALODATA_API_KEY`; credentials are never stored in the plugin package or workspace artifacts.

Default discovery scope:
- `region=VN`
- `language=vi-VN`
- `currency=VND`
- `date_range=last30Day`
- `is_affiliate=1`
- `need_image=1`
- `need_extra=true`
- rank candidates with Story Fit above commission.

## Required preflight

Every fresh episode has a persisted `.authoring/commerce/monetization.json` from the explicit prompt `Thêm quảng cáo Affiliate? YES/NO`.

`NO` means commerce is inert. `YES` means provider is exactly `kalodata`.

## Authoring artifacts

When enabled, the commerce workspace is `.authoring/commerce/`:

- `monetization.json`
- `product-query.json`
- `product-candidates.json`
- `product-selection.json`
- `affiliate-integration.json`
- `product-media.json`
- `affiliate-handoff.json`
- `media-source/*` original localized raster bytes
- `recent-motifs.json` compact topology+treatment history when available

These are outside Job@5. Only referenced renderer-safe transport assets under `assets/product/` enter the exact Job@5 ZIP.

## Creative contract

Do not hard-code one advertisement motif. Persist only compact topology+treatment history for anti-repetition; never copy prior narration, jokes or scenes into the new episode. Choose an insertion **topology** independently from a creative **treatment**.

Topologies: `interrupt`, `embedded`, `seed_and_reveal`, `split_exposure`, `post_payoff`, `callback`.

Treatments: `narrator_hijack`, `freeze_analysis`, `prop_zoom`, `character_demo`, `mystery_clue`, `visual_annotation`, `comparison_card`.

Commercial duration is adaptive **5–18 seconds**. Every segment has story-before/story-after anchors and an explicit return mechanism. Removing it must leave the Zodiac story coherent.

Claims are typed and source-bound: `observable_feature`, `seller_claim`, `kalodata_metric`, `creative_copy`. Kalodata metrics are snapshots, not timeless facts. Never invent testimonial, scarcity, before/after, health or financial claims.

## Product Media Adapter

Kalodata media is a remote source, never a runtime dependency.

1. Download HTTPS image bytes before Visual Review.
2. Accept PNG, JPEG or WebP only after byte sniffing and dimension validation.
3. Save source bytes under `.authoring/commerce/media-source/` and record source URL, MIME, dimensions and SHA-256 in `product-media.json`.
4. Build a deterministic **SVG transport** wrapper containing the verified raster bytes as a data URI.
5. Save the wrapper under `assets/product/` and reference that local SVG from Visual Intent / production assets.
6. Use an existing Job@5 category (`story_object` for commercial imagery, `prop` only for a true in-world physical product). Do not add a new transport category.
7. Visual Review must inspect the actual localized transport asset. Changed source bytes require re-review.

This preserves the current SVG-native renderer and exact Phase 03 package shape while making the approved product pixels immutable.

## Handoff

The creator-side `affiliate-handoff.json` includes exact product name, seller, Kalodata product ID, TikTok search query, snapshots and thumbnail provenance. It intentionally does not require a TikTok product URL.

Kalodata can support `AFFILIATE_MARKET_VERIFIED`; it does not prove account-level attachment. Until TikTok confirms it, expose **ACCOUNT_ATTACH_UNVERIFIED** (`account_attach_status=UNVERIFIED`).

## Failure policy

- missing monetization decision → `BLOCKED`
- YES + missing `KALODATA_API_KEY` → `BLOCKED`
- no product with adequate story fit → `BLOCKED`, do not force a sale
- missing/invalid product media → `BLOCKED`
- repeated recent topology × treatment without reason → `REVIEW`
- direct TikTok URL fabricated or inserted into handoff → `BLOCKED`
- changed commerce media after Visual Review → reopen Visual Review before Phase 03
