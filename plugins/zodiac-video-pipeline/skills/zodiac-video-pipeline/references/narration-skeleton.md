# Narration skeleton — fixed shapes for a single-sign short-form script

Scope: `single_sign` episodes only. `element_group`, `comparison` and `ranked_shortlist` keep their own shape. A skeleton is a **paragraph layout inside the one Story Shape** (`character_deconstruction`), never a second Story Shape. Paragraph breaks stay the scene seams, so do not split a paragraph to add scenes. The numbers are starting defaults to tune against real retention, not measured truths.

## 1. Choose the mode (one per script, never mixed)

| Mode | Use when | Length |
|------|----------|--------|
| **Long profile** (default) | A one-sign profile and the brief does not ask for something shorter | 450-750 tokens, about 100-165 s |
| **Short profile** | The user asks for a short video or a quick take | 120-300 tokens, about 27-67 s |
| **Situation** | The user explicitly asks for "Khi <cung> + một tình huống", and the premise still passes the Scenario-dependency test | 220-480 tokens, about 50-105 s |

Situation is the exception, not a default. The situation is only the carrier: remove it and the Zodiac insight must survive (Recognition & Identity Gate). If it does not, use a profile mode.

Style source: `style-references/profile-structure-references.md` (three reference subtitles) is for structure and pacing only. Never copy their wording, never treat them as evidence, never paste their lines into a Writer Brief.

## 2. Long profile — ten paragraphs, blank line between each

| # | Slot | Job | Limit (tokens) |
|---|------|-----|----------------|
| 1 | Hook | Promise a counted list that costs the viewer something; the first sentence ends by token 16 | ≤24 |
| 2-4 | Dealbreakers | "Thứ nhất / Thứ hai / Thứ ba": one thing each, with a concrete moment | 30-70 each |
| 5 | Outer | How the sign looks from outside, then what is really going on (contrast marker) | 50-90 |
| 6 | Dark | What the sign does once it has stopped caring (contrast marker) | 50-90 |
| 7 | Night | The private side (contrast marker) | 50-90 |
| 8 | Warm | What the sign does for someone it trusts | 50-90 |
| 9 | Turn | The one mechanism under all of it | 15-55 |
| 10 | Close | Returns to the hook's words with a changed meaning; no goodbye | ≤55 |

Sentences up to 22 tokens. Each section has a different semantic job, which is what keeps this from being "repeated trait listing". Contrast markers: nhưng, thế nhưng, vậy mà, thế mà, trong khi, thật ra, chứ không, ngược lại, mà lại.

## 3. Short profile — six paragraphs

| # | Slot | Job | Limit (tokens) |
|---|------|-----|----------------|
| 1 | Hook | A concrete claim that costs the viewer something; no greeting | ≤16 |
| 2-4 | Facets | Surface to inside, each with a contrast marker | 20-60 each |
| 5 | Turn | Names the mechanism behind all three | 10-40 |
| 6 | Close | Returns to the hook's non-topic words, now meaning something else | ≤25 |

Three facets, not four: a fourth idea is a second video. Whole script 120-300 tokens; sentences up to 20.

## 4. Situation — hook, moments, turn, close

Hook (≤16) names the situation and a promise; 6-14 moments (15-45 each) are one concrete action each, in time order, no two opening alike, at least two with a contrast marker; turn 10-40; close ≤35 returns to the hook's image. Whole script 220-480 tokens.

## 5. How this fits the existing Phase 1 rules

| Existing rule | Resolution |
|---------------|-----------|
| Narrative Design: "escalation rather than repeated trait listing" | Allowed because every long-profile section does a different job (warning, persona, withdrawal, private doubt, trust, mechanism). Two sections doing the same job are a defect. |
| `01-content.md`: "no fixed duration band unless the brief requires one" | Bands apply only to `single_sign` scripts and only through the chosen mode. Other formats keep no band. |
| `narration-rhythm.md`: over 120 s needs editorial review or an exception | Long profile usually lands near 120-135 s. On Web, state the estimated length at Content Review and get the user's explicit acceptance; the native `duration-exception.json` receipt is Local only and must carry the user's own quote. |
| `narrative-modes.md`: scene/conversation/situation are illustration devices | Situation mode stays a layout under `character_deconstruction`. |
| Recognition & Identity Gate: Scenario-dependency test | Situation mode must pass it (section 1). |
| Retention: hook evidence by token 16, a pull at least every 90 tokens, over 90 s needs at least 5 pull beats and 2 reframes | Hook promise ends by token 16; no profile section exceeds 90 tokens; long profile has 10 beats and its outer and night sections are the two reframes. |
| Engagement Design: one `beat_pull` per Narrative Plan beat | Use one beat per paragraph. Long profile: 10 beats; short profile: 6; situation: one per moment plus hook, turn, close. |
| Second-half pulse | Dark, night, warm and turn are the post-midpoint jobs (consequence, contrast, payoff, reframe); do not add an explanation-only paragraph there. |
| `engagement-engine.md`: `payoff_callback` | The close is the callback: hook words returning with new meaning. |
| Foreign words in TTS preflight | Keep the word ("online") and declare its reading in `spoken-performance-plan.json`; do not rewrite natural speech. |

## 6. Editorial shape check (Web has no validator; do this by hand before Content Review)

1. Count paragraphs against the mode. A different count means a different mode or a defect.
2. Hook: does the promise land by token 16, with no greeting and no "hôm nay mình sẽ"?
3. Does every section after the hook do a job no earlier section did?
4. Is there an outside-versus-inside turn in every slot that requires one?
5. Does any paragraph run past its ceiling, or any sentence past one breath?
6. Does the close return to the hook's words with a changed meaning, with no goodbye, recap or call to action (put calls to action in the caption)?
7. Read it aloud once: cut greeting, filler ("về cơ bản", "nói chung", "đừng quên") and any "theo dõi / phần sau" line.
8. Estimated length: state it in the Content Review summary, flag anything over 120 s, and never present an estimate as measured.

Name every limit you knowingly exceed and why. Local can run the same check: `node references/validate-narration-skeleton.mjs <workspace|narration.txt> --mode=long-profile|short-profile|situation`. The result is REVIEW or PASS, never an approval.

## 7. Trend phrase pass (optional, at most two phrases)

Natural current speech in a slot that needs it, not slang for its own sake.

1. The writer never calls tools. When a slot needs a current phrase, mark a SEARCH need in the draft. Language research then runs through the Evidence/Concept route in `research-and-viral-tools.md` (Narration step: search by function, never by bulk slang keyword; Parallel Search primary, Exa for deeper discovery, Tavily fallback), and only a sourced language note returns to the writer.
2. Classes follow the existing language taxonomy: `observed` (seen in an accessed source), `recurring` (three independent sites), `trend_candidate` (dated, growth unproven), `measured` (needs platform and time window). A roundup is a phrase corpus, not proof of current use. Language evidence never supports a Zodiac trait.
3. Reject a phrase that sounds forced, stale, text-only or hard to say. Prefer none to a bad one.
4. Record each kept phrase (phrase, slot, function, class, dated sources, why a narrator can say it aloud) in the Content Review summary. Local may keep it as `.authoring/trend-phrases.json` (`zodiac-trend-phrases@1`) and run `node references/validate-trend-phrases.mjs <workspace>`. It is not part of the `zodiac-phase1-handoff@2` inventory and changes nothing in Narrative Plan 2.1.

## 8. Compatibility

Narrative Plan stays `2.1` and the handoff stays `zodiac-phase1-handoff@2`. Every paragraph still gets a beat with an exact `voice_anchor` and `performance`; the skeleton only fixes how many paragraphs there are and what each one does.
