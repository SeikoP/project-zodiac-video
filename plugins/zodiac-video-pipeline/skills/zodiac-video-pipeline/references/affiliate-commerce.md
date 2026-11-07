# Fictional advertisement contract

Real affiliate commerce is paused. Fresh workspaces default to `mock_ad_enabled=true` and `affiliate_enabled=false`. Do not ask the affiliate YES/NO question, call Kalodata, request a key, discover products, download product media or create `.authoring/commerce/` files. Existing commerce files remain untouched; an old active affiliate flag requires an explicit routing decision before resuming.

## One source, shared review
After the stable base narration exists, author one `mock_ad` object inside `.authoring/narrative-plan.json` and insert its exact `text` into `narration.txt` before final QC and Content Review. Do not hand-edit the minimized writer brief or force the base story to serve an advertisement. An unchanged base story may reuse its Engagement Design after adding only `mock_ad`; final reviews still bind the complete updated plan and narration. Recompile writer-brief lineage after updating the Narrative Plan, then rerun the narration checkpoint and grounded reviews against the final text. This is a fictional creative interlude, not a real endorsement or offer.

The object contains only:
- `fictional_product`: an invented product name, spoken in the copy;
- `text`: exact spoken copy including **Quảng cáo hư cấu**;
- `topology`, `treatment`, `commercial_duration_s`, `return_mechanism`;
- `story_before_anchor`, `story_after_anchor`: exact narration excerpts before and after the copy.

Reuse the advertising structure, not product intelligence:
- topology: `interrupt`, `embedded`, `seed_and_reveal`, `split_exposure`, `post_payoff`, `callback`;
- treatment: `narrator_hijack`, `freeze_analysis`, `prop_zoom`, `character_demo`, `mystery_clue`, `visual_annotation`, `comparison_card`;
- return: `snap_back`, `unfreeze`, `zoom_out`, `character_callback`, `narrator_callback`, `prop_callback`, `dialogue_resume`.

Use one contiguous 5–18 second estimated exposure. For split/seed/callback structures, the opening hint or later callback belongs to the story; the disclosed advertising copy remains contiguous. Removing the interlude must leave the Zodiac story coherent. Avoid copying the same gag across episodes. No real seller, product ID, price, commission, affiliate URL, testimonial or market/health/financial claim. Duration remains estimated until runner TTS.

## Mandatory story-hijack (new fresh workspaces)

Fresh state sets `mock_ad_story_hijack_required=true`; older episodes stay compatible. At both commerce gates, `mock_ad.story_hijack` requires seven exact strings: `trigger` (in `story_before_anchor`), `pivot`, `product_reveal` (must name `fictional_product`), `demo`, `wordplay`, `cta` (the last four spoken-commercial beats occur in order after pivot), and `snapback` (must immediately start `story_after_anchor`). Keep one 5–18s interlude.

Creative rule: hijack a **real story detail** → sudden product pitch for a **tangible everyday object** → fast visual demo + punchy pun → short CTA → hard-cut back by dismissing/reframing the product and continuing the Zodiac tension. Do not sell an abstract personality fix, explain the ad transition or add a moral after the cut. Removing the spot must leave a coherent story. Automated checks cover source/ordering/copy only; editorial Content Review owns humor, relevance and abruptness. Preserve required fictional disclosure inside the ad copy; never add an explanatory paragraph.

## Visuals and changes
Represent the interlude using normal scenes/entities inside `.authoring/visual-intent.json`; use the normal local native assets and shared Visual Review. No product adapter, remote media, new transport category or separate approval artifact. The spoken copy must survive projection to `production.json` exactly.

Run `node features/commerce/validate-affiliate-integration.mjs <workspace> content` before Content Review and the same command with `visual` before Visual Review. These are native checks, not user approval. Any change to the ad's text or creative plan reopens the affected content and downstream visual review. Phase 03 keeps the existing Job@5 package contract and one ZIP.
