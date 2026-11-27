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

## Long profile mode (the shape of the three reference subtitles)

Use for a single-sign profile that must run about two minutes. The three reference subtitles (Bạch Dương, Bọ Cạp, Song Tử; 121-139 seconds, 560-680 tokens) share one order: the things the sign cannot stand, outside versus inside, the dark side, the warm side, one closing line. This mode fixes that order. Check with `node references/validate-narration-skeleton.mjs <workspace|narration.txt> --mode=long-profile`.

| # | Slot | Job | Limit (tokens) |
|---|------|-----|----------------|
| 1 | Hook | Promise a counted list that costs the viewer something | ≤24 |
| 2-4 | Dealbreakers | "Thứ nhất / Thứ hai / Thứ ba": one thing each, with a concrete moment | 30-70 each |
| 5 | Outer | How the sign looks from outside, then what is really going on (contrast marker required) | 50-130 |
| 6 | Dark | What the sign does when it has given up on you (contrast marker required) | 50-130 |
| 7 | Night | The private side (contrast marker required) | 50-130 |
| 8 | Warm | What the sign does for someone it trusts | 50-130 |
| 9 | Turn | The one mechanism under all of it | 15-55 |
| 10 | Close | Returns to the hook's words with a changed meaning; no goodbye | ≤55 |

Whole script 450-750 tokens (about 100-165 seconds at 270 tokens/minute). Sentences up to 22 tokens. Over 120 seconds the plugin's own duration check (`short-form-duration.mjs`) still requires an editorial review or `duration-exception.json`; that exception needs the user's own review quote and is never written for them.

Foreign words such as "online" stay in the narration. Declare their reading in `spoken-performance-plan.json` (`pronunciation`) instead of rewriting the line.

## Situation mode (one sign, one relatable situation)

Use when the video is "Khi <cung> + <tình huống ai cũng từng gặp>" (a group project, a parents' meeting, an exam) instead of a trait profile. The title is the hook; the sign walks through the situation in time order, one concrete moment per paragraph, and each moment goes a step further than the last. Check with `node references/validate-narration-skeleton.mjs <workspace|narration.txt> --mode=situation`.

| Slot | Job | Limit (tokens) |
|------|-----|----------------|
| Hook | The situation plus a promise that costs something ("…có đúng một ngôi sao") | ≤16 |
| Moments (6–14) | One specific action by the sign in that situation, in time order; no two moments open alike | 15–45 each |
| Turn | The mechanism behind all moments, in one line | 10–40 |
| Close | Returns to the hook's image with a changed meaning; no goodbye | ≤35 |

Whole script 220–480 tokens (about 50–105 seconds). At least two moments need an outside-versus-inside contrast marker. These limits are defaults to tune on real retention, not measured truths.

Why this mode exists: a profile of one sign gives the viewer one sign to recognise; a situation gives them a scene they have lived, which is the shape the top videos of a 586K-follower channel (`@cunghoangdao_tarot`, checked 2026-11-28 by title and view count only, scripts and retention unseen) share across about a dozen videos of 1.6-3.1M views. One channel is an observation, not a recurring pattern.

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
