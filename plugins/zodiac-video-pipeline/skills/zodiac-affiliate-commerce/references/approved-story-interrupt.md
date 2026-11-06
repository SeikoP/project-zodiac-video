# Approved Zodiac affiliate story-interrupt structure

This is the approved macro-structure for commercial narration inside Zodiac episodes. Preserve the episode's existing narrator voice and story authority. For the current series, the narrator remains NORMAL ↔ SHARP; the ad beat uses a deliberate sharp spike rather than a warm sales voice.

## Core sequence

1. **Build real story tension first.**
   The audience must already care about the unresolved observation, contradiction, clue, reaction, or question. Do not open with the product and do not manufacture a fake problem merely to sell something.

2. **Use an existing story object or detail as the trigger.**
   The commercial interruption must spring from something already visible or already mentioned in the story: a cup, phone, bag, mirror, notebook, clothing item, desk object, etc. The product may be that object or may be directly revealed by it. Product fit is judged by story continuity, not just by functional utility.

3. **Hit a sharp interruption beat.**
   Use a short tonal spike such as `MÀ KHOAN.` or another episode-appropriate abrupt line. The interruption should feel intentional and slightly mischievous, not like the narrator forgot the story.

4. **Hard-cut to the product.**
   Visually isolate the product for a very short hero cut, normally around 2–4 seconds inside the total 5–18 second commercial exposure. The machine representation will commonly map this macro structure to `interrupt` plus a fitting treatment such as `narrator_hijack` or `prop_zoom`.

5. **Name the product, then prove only what is sourced.**
   Keep the spoken sell compact:
   - exact product name;
   - one verified USP or observable feature;
   - optionally one very fast demo of a second verified feature;
   - no invented performance, comfort, durability, health, savings, or superiority claim.

6. **Use a short CTA.**
   The CTA is one compact line appropriate to the publishing surface, for example a cart/basket reference when that placement is actually available. Do not turn the CTA into a second sales paragraph.

7. **Return with a Product Callback Snapback.**
   The snapback must preserve the product value just established, then use a real feature, visual property, action, or short semantic echo from the product beat to reactivate the unresolved story tension. The product must not be dismissed, belittled, or framed as unnecessary after the CTA.

   Preferred shape:
   - product value remains intact;
   - one short bridge line connects product → story;
   - the unresolved question/conflict immediately resumes;
   - the bridge is sharper than a neutral transition and ideally makes the story tension stronger.

   Example abstraction only: `Sản phẩm giữ được X. Còn nhân vật vẫn giữ nguyên Y.` The wording and metaphor must be authored fresh for the episode, and any factual product claim inside the bridge must be source-bound.

   If no honest feature-based callback exists, use a neutral but fast story callback that does **not** reduce product desirability. Never invent a false feature just to make a pun work.

8. **Pay off the Zodiac story, not the ad.**
   The commercial segment must not become the ending. The final reveal, reversal, callback, joke, or insight still belongs to the Zodiac story.

## Tone and rhythm

- Preserve the narrator's existing persona; do not switch to a warm presenter or conventional shopping-host voice.
- The interruption is intentionally louder/sharper than the surrounding narration, then the return cuts back fast.
- Prefer short spoken lines during the commercial beat.
- Avoid explanatory transitions such as `nhân tiện`, `tiện đây`, `sản phẩm này phù hợp vì`, or long feature lists.
- The ad should feel like the narrator briefly hijacked their own story, not like an external sponsor took over the video.
- The snapback should sound like a punchline/callback, not a disclaimer that the product is irrelevant.

## Structural constraints

- Total commercial exposure still obeys the executable 5–18 second contract.
- `story_before_anchor` is the last exact story line before the tonal hijack.
- `story_after_anchor` is the first exact story line after the Product Callback Snapback.
- `return_mechanism` should encode the actual return, commonly `narrator_callback`, `prop_callback`, `character_callback`, or `snap_back` when the authored beat genuinely matches it.
- All product claims remain typed and source-bound: `observable_feature`, `seller_claim`, `kalodata_metric`, or `creative_copy`.
- The delete test is mandatory: remove the entire interruption and the original story must remain logically continuous.
- Do not change the approved premise, character interpretation, or Zodiac payoff to create room for commerce.
- A callback may reuse the *idea* of a verified product feature, but must not strengthen or broaden that claim beyond its evidence.

## Snapback commercial-safety rule

Reject any return line whose natural reading tells the viewer that the product is unimportant, unnecessary, disposable, irrelevant, or not worth attention immediately after the CTA.

Explicit anti-patterns include shapes such as:
- `Nhưng [cung] quan tâm gì cái [sản phẩm]...`
- `Kệ cái [sản phẩm]...`
- `Cái [sản phẩm] không quan trọng...`
- `Có hay không cũng được...`
- any joke whose punchline depends on making the product look useless.

The story may regain priority without negating the product. The preferred return is **value preserved → semantic callback → tension reactivated**.

## Anti-patterns

Reject these unless the episode genuinely demands them:

- product appears only because the writer wants an ad slot;
- product must solve an invented obstacle such as a sudden low battery solely to justify the ad;
- narrator pauses the story to explain why the product is useful;
- generic `đây là món đồ...` sales copy;
- long USP lists;
- soft transition back to the story;
- dismissive snapback that lowers perceived product value;
- ad becomes more memorable than the unresolved Zodiac tension;
- unverified feature claims or fabricated TikTok availability.

## Approved example abstraction

The approved Scorpio structure is now abstracted as:

`character notices a suspicious everyday object → tension rises → abrupt MÀ KHOAN hijack → reveal/product hero → verified USP + fast demo → short cart CTA → Product Callback Snapback preserves the product value and echoes a product property into the unresolved suspicion → story resumes harder → mundane reveal resolves the mystery.`

The example is a structure and tone reference, not reusable wording. Every episode must build its own trigger, commercial copy, callback bridge, and payoff from its actual story and verified product evidence.
