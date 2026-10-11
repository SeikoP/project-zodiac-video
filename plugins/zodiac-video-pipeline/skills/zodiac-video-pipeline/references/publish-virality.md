# Zodiac Publish Virality v2.3.1 — Phase 02 Publish Prep

This document owns publishing copy selection. It does NOT rewrite user-approved Character Narration or Story Spine, create a separate phase, or alter Job@5/runtime contracts.

## Five outputs, five jobs
1. **Spoken hook** is the already-approved opening from narration (read-only). It promises the video topic; never replace it at Publish Prep.
2. **Search/title** (optional `publish.title`) is readable Vietnamese including the sign AND a specific identity tension/search term. It is NOT a repeat of the entire first spoken line. Recommended editorial length about 35–80 characters; use judgement rather than truncating.
3. **Cover hook** (`publish.cover.hook`) is extremely scannable (normally 3–8 Vietnamese words). Deliver one sharp tension, contradiction, or tease; title and cover must be complementary rather than identical. Must accurately reflect a significant beat/payoff.
4. **TikTok caption** (`publish.caption`) adds a natural, specific line of context or a polarizing but honest question that earns conversation; never re-summarize the whole narration or promise unrelated content. Prefer one clear question over forced "comment/share" bait.
5. **Hashtags** (`publish.hashtags`) use meaningful layered relevance:
   - sign identity: e.g. `#BoCap`, accurate to cover sign;
   - zodiac/niche: e.g. `#12CungHoangDao` OR `#CungHoangDao` (choose relevant distinct role, avoid redundant copies);
   - episode-specific topic or tension: e.g. `#TinhCachBoCap`, `#KhoMoLong` only when actually discussed;
   - series/format when genuinely present: e.g. `#GiaiMaTinhCach`;
   - brand: `#bungmoto`.
   Typically 4–7 relevant tags. The target is COVERAGE OF MEANING, NOT a fixed quota or claimed optimal algorithm number. More tags do not guarantee increased reach. Avoid `#fyp`/`#viral`/`#xuhuong` by default, unrelated trending tags, repeated generic variants, and invented trending status. When a specific currently trending tag is considered, require dated audience/region evidence; omit if unavailable. Hashtags must not contain whitespace/punctuation beyond Unicode letters, digits and underscore after #.

## Editorial candidate selection
Create 2–3 DIFFERENT hook/title/cover/caption options privately: sharp comedic provocation, character contradiction, and emotional curiosity. Choose the version with the most concrete sign-specific promise and accurate content payoff. Edgy language, strong satire and disagreement are permitted when earned; do not automatically prefer a bland/soft option. Identify the strongest search keyword and viewer recognition trigger. No stale formulas (e.g. "bạn có biết...") by default.
 
## Visual cover handoff
Use current `tilted_top_hook`, native source scene and real character/prop/effect states. Keep large legible sign identity + short hook; face/reaction must show the conflict. Do NOT generate a separate cover AI image, new SVG or alter renderer coordinates. Phone safe-zone/layout and native preview are runner responsibilities. No extra background for banter-only moments; selecting cover source scene follows actual scene semantics.

## Compatibility
Keep the stable `publish.json`: cover.identity/hook/source_scene_id/visuals, caption, hashtags and source fields unchanged. `publish.title` is optional metadata for copy/SEO and does not replace `cover.hook`. `publish-copy.txt` retains COVER IDENTITY / HOOK / TIKTOK CAPTION / HASHTAGS lines. It MAY include `TITLE: <value>` for copy convenience when title is supplied. Existing packages lacking `title` remain valid but should be editorial REVIEW for new content. Do not include extra title keys in renderer-specific cover object.

## QC before publish-ready
* Spoken hook, SEO title, visual cover hook, caption, hashtag set must share the same sign and specific tension.
* A stronger cover hook must be supported by at least one major narration beat; no fabricated claims or generic bait.
* Distinctive hook/content enough that replacing the sign with another sign would weaken the promise.
* Hashtags cover sign + meaningful niche + specific topic + brand and optional series (when applicable); no duplicate or unrelated tags.
* Cover identity/asset bindings resolve to production states; native cover legibility and safe-zone are confirmed by runner, not fabricated by plugin.
* Reject empty, copied, entirely redundant metadata. Don't hard-fail old packages solely for lacking optional title or editorial tag layers; add REVIEW notes.
* No measured viral lift is claimed without video analytics.

TikTok official reference: https://newsroom.tiktok.com/5-tips-for-tiktok-creators?lang=en — relevance over volume; #FYP not special. Trends validation: https://ads.us.tiktok.com/resources/help/article/how-to-use-trends?lang=en .

## Gate semantics
`PUBLISH_PREP_PASS` means schema and existing scene/entity references are valid, NOT that editorial Publish Quality passed. For new material, `PUBLISH_EDITORIAL_REVIEW_REQUIRED` must be resolved through documented editorial judgment before calling the package creatively finished. Do not upgrade warnings to PASS automatically. Existing legacy packages remain importable. Local runner alone can verify actual cover pixels and metadata copy parity.
