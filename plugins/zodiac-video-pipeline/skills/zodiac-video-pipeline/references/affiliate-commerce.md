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

## Mandatory story-hijack pattern for new episodes

New fresh workspaces set `flags.mock_ad_story_hijack_required=true`. This makes the **story-triggered fake commercial** mandatory at the existing content/visual affiliate-integration gates. Older workspaces without this flag retain their approved contract and are not silently rewritten. The single disclosed fictional spot remains 5–18 seconds, self-contained and removable without breaking the Zodiac story.

Design the insertion **after the base story works**. Follow this sequence:
1. **Trigger:** An exact observable word, action, object or image is already present in `story_before_anchor`. The viewer believes the narration will continue normally.
2. **Pivot:** A sudden spoken hijack (such as “MÀ KHOAN”) reinterprets the trigger as a product opportunity. Do not announce “chúng ta chuyển sang quảng cáo”.
3. **Product reveal:** Show a tangible ordinary object, not a fake personality diagnosis, relationship verdict, miracle device or an abstract app fixing the episode's psychological conflict.
4. **Rapid demonstration + wordplay:** One specific, visually performable benefit and one compact twist/pun. The commercial should sound like an actual exaggerated sales pitch, not a sketch explaining the story.
5. **CTA:** One short imperative. Do not require a real shop, link or real claim.
6. **Snapback:** Immediate hard cut to a story line that dismisses or reframes the object's relevance and resumes the *same unresolved tension*. No “trở lại câu chuyện” or transition narration. Keep all lines after the cut outside the commercial copy.

In `mock_ad.story_hijack`, author exact strings `trigger`, `pivot`, `product_reveal`, `demo`, `wordplay`, `cta`, `snapback`. The trigger must occur in the before anchor; pivot → product_reveal → demo → cta must occur in order within `mock_ad.text`, with `wordplay` also present; `snapback` must start the after anchor and the post-ad narration. Product reveal must name `fictional_product`. These checks validate structure, not humor, commercial timing or creative merit. Perform the editorial check that the product does not steal the Zodiac premise, the return line truly snaps back, and the wordplay is earned rather than mechanically inserted.

Keep disclosure required by the current fictional-ad contract; do not add a separate explanatory paragraph about advertising. Phase 02 must plan the object, short product cut and hard snapback as actual visual events while preserving the approved words. Never silently select an unapproved candidate or alter existing approved narration.

## Visuals and changes
Represent the interlude using normal scenes/entities inside `.authoring/visual-intent.json`; use the normal local native assets and shared Visual Review. No product adapter, remote media, new transport category or separate approval artifact. The spoken copy must survive projection to `production.json` exactly.

Run `node features/commerce/validate-affiliate-integration.mjs <workspace> content` before Content Review and the same command with `visual` before Visual Review. These are native checks, not user approval. Any change to the ad's text or creative plan reopens the affected content and downstream visual review. Phase 03 keeps the existing Job@5 package contract and one ZIP.
