---
name: zodiac-affiliate-commerce
description: Use with zodiac-video-pipeline on fresh Zodiac episodes to optionally add TikTok Shop Affiliate commerce. It owns the YES/NO monetization gate, Kalodata product discovery, product-story integration, product media localization, motif diversity, and the creator handoff for finding the product in TikTok.
---
# Zodiac Affiliate Commerce

This is an optional extension to `zodiac-video-pipeline`; it never replaces the three editorial phases or their genuine Content Review / Visual Review gates.

## Monetization gate

Before commerce discovery on a fresh episode, ask exactly:

`Thêm quảng cáo Affiliate? YES/NO`

Persist the answer with `features/commerce/monetization-gate.mjs`.

- `NO`: run the normal Zodiac pipeline. Do not call Kalodata, do not create commerce assets, and do not alter narration for sales.
- `YES`: set `provider=kalodata` and activate this extension.
- Do not ask the user for a product link. V1 has one canonical provider: Kalodata.

If a persisted monetization decision already exists for the active workspace, reuse it instead of asking again.

## Phase 01: story first, commerce before Content Review

Draft the base Zodiac narration through the existing bounded writer flow first. After a stable draft exists and before final Content Review:

1. Derive 2–6 Vietnamese product-search keywords from physical objects, activity, setting, tension, and demo opportunities in the actual narration.
2. Use `features/commerce/kalodata-client.mjs` to query Vietnam (`VN`) affiliate products. `KALODATA_API_KEY` is required; no alternate product provider is allowed in V1. Missing access is `BLOCKED`.
3. Rank candidates with `features/commerce/commerce-core.mjs`. Story Fit outranks commission. A high-commission product with weak story fit must not win.
4. Persist the selected product and creator handoff with `features/commerce/write-product-selection.mjs`.
5. Author `.authoring/commerce/affiliate-integration.json` using one **topology × treatment** pair, not a single repeated ad template.
6. Validate with `features/commerce/validate-affiliate-integration.mjs` before showing Content Review.

### Creative integration contract

Supported insertion topologies: `interrupt`, `embedded`, `seed_and_reveal`, `split_exposure`, `post_payoff`, `callback`.

Supported treatments: `narrator_hijack`, `freeze_analysis`, `prop_zoom`, `character_demo`, `mystery_clue`, `visual_annotation`, `comparison_card`.

Commercial exposure is adaptive **5–18 seconds**. Flash is exceptional; standard and demo treatments can be longer when the product needs proof or action.

Every integration must define:
- `story_before_anchor` and `story_after_anchor` from the approved narration;
- `return_mechanism` so the story resumes deliberately;
- product asset IDs;
- evidence-safe claims typed as `observable_feature`, `seller_claim`, `kalodata_metric`, or `creative_copy`.

The delete test remains mandatory: removing the commercial segment must leave `story_before + story_after` logically coherent. The Zodiac payoff remains the authority.

### Diversity

Do not repeat the same topology × treatment pair by habit. Read the persisted series/workspace commerce history when present; never use account memory as motif history. Use `features/commerce/commerce-history.mjs` to record/import the compact topology+treatment ledger. Repeating the same pair twice in the recent three episodes requires a concrete `repeat_reason`, otherwise validation returns `REVIEW`.

## Phase 02: Product Media Adapter before Visual Review

Use `features/commerce/product-media-adapter.mjs` after product selection and before Visual Review.

The Product Media Adapter:
- downloads only HTTPS Kalodata product media;
- validates PNG/JPEG/WebP bytes and dimensions;
- stores immutable source raster bytes under `.authoring/commerce/media-source/` with SHA-256 and source provenance;
- emits deterministic **SVG transport** wrappers under `assets/product/` so the existing SVG-native Job@5 / zodiac-renderer boundary remains unchanged;
- never makes the renderer fetch a remote image URL at render time.

Use the SVG transport asset in Visual Intent with an existing supported transport category such as `story_object` for commercial hero/detail imagery or `prop` when the product truly exists as an in-world physical prop. Do not invent a new Job@5 asset category.

Product visuals have three semantic roles: `STORY`, `PROOF`, `SELL`. Separate `story_product_visual` from `commercial_product_visual` even if both derive from the same source product.

Visual Review must show the actual localized product transport asset, not a placeholder. Any source/media change after approval reopens the affected Visual Review surface.

## Affiliate handoff

`.authoring/commerce/affiliate-handoff.json` is a creator-side sidecar and is **not** added to the exact Job@5 ZIP shape. It must include:
- exact product name;
- seller name;
- Kalodata product ID;
- `tiktok_search_query` built from exact product name + seller;
- price, commission, sales and video-revenue snapshots when available;
- thumbnail source/provenance;
- `AFFILIATE_MARKET_VERIFIED` when Kalodata affiliate data is present;
- `ACCOUNT_ATTACH_UNVERIFIED` / `account_attach_status=UNVERIFIED` until TikTok itself confirms the creator account can attach the product.

Never fabricate a TikTok product URL and never claim account-level attachability from Kalodata data alone.

## Commands

- Gate: `node features/commerce/monetization-gate.mjs <workspace> <yes|no>`
- Discover: `node features/commerce/kalodata-client.mjs discover <workspace>`
- Select: `node features/commerce/write-product-selection.mjs <workspace> <product.json>`
- Media: `node features/commerce/product-media-adapter.mjs <workspace> <product-detail.json>`
- History: `node features/commerce/commerce-history.mjs <workspace> <affiliate-integration.json> [episode-id]`
- Validate: `node features/commerce/validate-affiliate-integration.mjs <workspace>`

Commerce files under `.authoring/commerce/` are authoring evidence/state, not approval receipts. Existing Zodiac review and Phase 03 gates remain authoritative.
