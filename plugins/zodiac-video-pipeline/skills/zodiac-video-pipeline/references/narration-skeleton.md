# Narration skeleton — one fixed shape (short-form, profile style)

Use for a sign/topic profile that must hold a TikTok viewer: one claim, three proofs, one turn, one return. It does not apply to scene-driven story episodes. Check with `node references/validate-narration-skeleton.mjs <workspace|narration.txt>`; the result is REVIEW or PASS and never an approval. The numbers are starting defaults to tune against real retention, not measured truths.

## The six paragraphs (blank line between each)

| # | Slot | Job | Limit (tokens) |
|---|------|-----|----------------|
| 1 | Hook | A concrete claim that costs the viewer something. No greeting, no "hôm nay mình sẽ". | ≤16 |
| 2 | Facet 1 | Surface → inside. Must carry a contrast marker (nhưng, thế nhưng, vậy mà, thế mà, trong khi, thật ra, chứ không, ngược lại, mà lại). | 20–60 |
| 3 | Facet 2 | A different behavior, same shape. | 20–60 |
| 4 | Facet 3 | A third behavior; the strongest goes here. | 20–60 |
| 5 | Turn | One line that names the mechanism behind all three facets. | 10–40 |
| 6 | Close | Returns to the hook with at least two of its non-topic words, now meaning something else. No goodbye, no call to action. | ≤25 |

Whole script 120–300 tokens (about 27–67 seconds at 270 tokens/minute). Any sentence over 20 tokens is flagged: write for one breath.

## Rules that keep it from rambling

- Three facets, not four. A fourth idea is a second video.
- A facet that only restates the previous one is a defect, not a fourth beat.
- The turn explains; it does not add a new behavior.
- The close is the hook seen again. A recap or a moral is not a close.
- Cut greeting, filler ("về cơ bản", "nói chung", "đừng quên") and any "theo dõi / phần sau" line; put calls to action in the caption.

## Example (shape only, not evidence-checked)

```
Song Tử im lặng không phải vì hết chuyện. Họ đang chấm điểm bạn.

Bạn kể một chuyện, Song Tử hỏi mười câu liền. Nhìn như tò mò, nhưng thật ra họ đang ghép bức tranh xem lời bạn có khớp nhau không. Câu nào lệch, họ nhớ.

Bạn hứa một câu cho có, họ không cãi. Họ chỉ ngừng kể cho bạn nghe chuyện của họ, thế nhưng bạn thì cứ tưởng mọi thứ vẫn ổn.

Khi giận, Song Tử cười rất duyên. Nhưng tin nhắn của họ ngắn dần, trả lời chậm dần. Đến khi bạn nhận ra, mình đã ra khỏi vòng trong rồi.

Song Tử không lạnh lùng. Họ chỉ không phí sức vào người chưa chứng minh được sự thật thà.

Nên lần sau Song Tử im lặng, đừng hỏi họ giận không. Hãy hỏi mình đã chấm điểm đúng chưa.
```

The hook says "im lặng" and "chấm điểm"; the close returns to both with a changed meaning.

## Trend-phrase pass (after the draft, before Content Review)

Optional, at most **two** phrases per script. The aim is natural current speech in a slot that needs it, not slang for its own sake.

1. Find the slot's job first (hook pressure, a verdict line, the close). Search by function, never by bulk slang keyword; the routing rules are in `research-and-viral-tools.md` (Narration step). Language evidence never supports a Zodiac trait.
2. Each kept phrase goes in `.authoring/trend-phrases.json` (`zodiac-trend-phrases@1`): `phrase`, `slot` (hook, facet1-3, turn, close), `function`, `evidence_class`, `sources[]` with url and date, and a `natural_check` saying why this narrator can say it aloud.
3. Classes follow the existing language taxonomy: `observed` (seen in an accessed source), `recurring` (three independent sites), `trend_candidate` (dated, growth unproven), `measured` (needs `platform` and `window`).
4. Reject a phrase that sounds forced, stale, text-only or hard to say. Prefer none to a bad one.

Check: `node references/validate-trend-phrases.mjs <workspace>`.

## Interaction with the rest of Phase 1

- Paragraph boundaries are still the scene seams, so a skeleton script yields six scenes. Do not split a paragraph to add scenes.
- Evidence, voice profile, Engagement Design and the Retention Quality limits still apply. `engagement-design.json` should list the three facets as its three `beat_pull` entries (the hook and close ride on `entry_hook` and `payoff_callback`).
- Approved narration stays byte-locked; this check never edits it.
