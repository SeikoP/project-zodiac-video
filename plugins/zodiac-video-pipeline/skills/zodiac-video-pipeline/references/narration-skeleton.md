# Narration skeleton — fixed shapes for a single-sign short-form script

Scope: `single_sign` episodes only. `element_group`, `comparison` and `ranked_shortlist` keep their own shape. A skeleton is a **paragraph layout inside the one Story Shape** (`character_deconstruction`), never a second Story Shape. Paragraph breaks stay the scene seams, so do not split a paragraph to add scenes. The numbers are starting defaults to tune against real retention, not measured truths. Lower bounds are editorial targets, never a reason to pad. Prefer a shorter complete beat and disclose a justified deviation; native structural diagnostics remain diagnostics and are not waived.

## 1. Choose the mode (one per script, never mixed)

| Mode | Use when | Length |
|------|----------|--------|
| **Short profile / compact profile** (default) | One-sign profile; normally just over one minute, unless explicitly shorter | 120-405 tokens supported; normal target 290-405, about 65-90 s before pauses |
| **Long profile** | Only if distinct insights earn the extra slots or the user requests longer | 450-750 tokens as guidance, about 100-167 s |
| **Situation** | The user explicitly asks for "Khi <cung> + một tình huống", and the premise still passes the Scenario-dependency test | 220-480 tokens, about 50-105 s |

Situation is the exception, not a default. The situation is only the carrier: remove it and the Zodiac insight must survive (Recognition & Identity Gate). If it does not, use a profile mode.

Style source: `style-references/profile-structure-references.md` (three reference subtitles) is for structure and pacing only. Never copy their wording, never treat them as evidence, never paste their lines into a Writer Brief.

**Duration discipline:** choose the shortest complete profile. The normal target is just over 60 seconds, preferably 65-90 seconds; not an enforced maximum or a minimum token quota. If a compact profile is complete, stop. Do not invent scenes, stretch sentences or add repeated explanations to reach a time band. At 270 spoken tokens/min, 290-405 tokens is about 64-90 seconds before pauses; actual TTS length is a later measurement. If the brief explicitly requests a shorter duration, honor it. If a draft falls short of 60 seconds, add only a missing meaningful facet or flag the estimate for review; never fill time. A long profile is opt-in by editorial need, not the default.

## 2. Long profile — ten paragraphs, blank line between each

| # | Slot | Job | Limit (tokens) |
|---|------|-----|----------------|
| 1 | Hook | Promise a counted list that costs the viewer something; the first sentence ends by token 16 | ≤24 |
| 2-4 | Concept-led facets | "Thứ nhất / Thứ hai / Thứ ba": one promised behavior each, with a recognizable cue or brief example where useful; dealbreakers only for warning concepts | 30-70 each |
| 5 | Outer | How the sign looks from outside, then what is really going on (contrast marker) | 50-90 |
| 6 | Dark / friction | A cost, uncomfortable limit or contradiction of the active concept (contrast marker); withdrawal only when it advances that concept | 50-90 |
| 7 | Night | The private side (contrast marker) | 50-90 |
| 8 | Warm | What the sign does for someone it trusts | 50-90 |
| 9 | Turn | The one mechanism under all of it | 15-55 |
| 10 | Close | Returns to the hook's words with a changed meaning; no goodbye | ≤55 |

Sentences up to 22 tokens. Each section has a different semantic job, which is what keeps this from being "repeated trait listing". Contrast markers: nhưng, thế nhưng, vậy mà, thế mà, trong khi, thật ra, chứ không, ngược lại, mà lại.

## 3. Short profile / compact profile — six paragraphs (default)

| # | Slot | Job | Limit (tokens) |
|---|------|-----|----------------|
| 1 | Hook | A concrete claim that costs the viewer something; no greeting | ≤16 |
| 2-4 | Facets | Surface to inside, each with a contrast marker; combine cost/private/warm side only where meaningful | 20-90 each |
| 5 | Turn | Names the mechanism behind all three, only if a new insight is needed | 10-55 |
| 6 | Close | Returns to the hook's non-topic words, now meaning something else | ≤35 |

Three facets, not four: do not add a fourth merely to extend runtime. Whole script 120-405 tokens; sentences up to 22. The compact mode keeps the existing `short-profile` validator identifier. Lower bounds remain diagnostics, not padding instructions.

## 4. Situation — hook, moments, turn, close

Hook (≤16) names the situation and a promise; 6-14 moments (15-45 each) are one concrete action each, in time order, no two opening alike, at least two with a contrast marker; turn 10-40; close ≤35 returns to the hook's image. Whole script 220-480 tokens.

## 5. How this fits the existing Phase 1 rules

| Existing rule | Resolution |
|---------------|-----------|
| Narrative Design: "escalation rather than repeated trait listing" | Allowed because every long-profile section does a different job (warning, persona, withdrawal, private doubt, trust, mechanism). Two sections doing the same job are a defect. |
| `01-content.md`: "no fixed duration band unless the brief requires one" | Bands apply only to `single_sign` scripts and only through the chosen mode. Other formats keep no band. |
| `narration-rhythm.md`: over 120 s needs editorial review or an exception | Compact profile normally lands around 65-90 s; longer content over 120 s needs explicit review. On Web, state the estimated length at Content Review and get the user's explicit acceptance; the native `duration-exception.json` receipt is Local only and must carry the user's own quote. |
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

## 6b. Concept fit, hook and Content Review evidence (long and short profile)

**Concept fit.** Slots 2-4 keep "Thứ nhất / Thứ hai / Thứ ba", but their job follows the concept. For a warning concept ("điều sẽ làm cung này gạch tên bạn") they are dealbreakers. For a concept whose thesis contrasts two audiences (for example `love-sincere`: how the sign treats an ordinary person versus someone who really matters) each of the three must already show that contrast, so the thesis is visible by paragraph 2, not paragraph 5. Check: write the concept's one-line contrast, then point to it in each of paragraphs 2, 3 and 4.

**Hook carries the concept.** The hook promises something that costs the viewer or names the concept's contrast. Delete the sign name from the hook: the concept (not just "a sign and a number") must still be readable. A hook that only announces a count of vague things ("ba kiểu … khó bỏ qua") fails.

**Content Review evidence.** The review table shows evidence, not assertions:
1. Per-paragraph token table (paragraph, tokens, limit) and the total.
2. Sign-swap test names the swap sign and quotes the line that stops working. If nothing breaks, say so and rework the line.
3. Audio-only review lists what was checked: unclear referent (who is "họ"/"người ấy"), fragment sentences that start an ordinal paragraph, lines that do not parse when spoken, repeated words. Name each defect and its fix. An empty list is written "none found after reading each paragraph".
4. Trend search status: `searched: yes/no`, the function searched, and the outcome. "Không dùng" alone is not a record.
5. Story Visual: the candidate review from `story-visual-direction.md` (at least two candidates, failed condition each).
6. Motif: where it is carried (Writer Brief `motif_candidates`; never a field of Plan 2.1).

## 6c. Narrative Economy Review (all modes)

Run after a complete draft, before Content Review. A script can be structurally compliant and still feel stretched. Diagnose semantic density rather than maximizing duration or minimizing words. Do not prescribe a fixed reduction percentage or force a rewrite if no material defect exists.

1. **Distinct semantic gain:** name what each beat adds (action, decision, consequence, contrast, reframe, payoff). Compare with the earlier beats, not merely the adjacent one. If removing a line or paragraph loses no useful meaning, shorten the line or redesign the paragraph while preserving the chosen shape. Do not add a fourth example just to reach a lower token target.
2. **Concept-aligned friction:** in Long Profile, the Dark slot exposes a cost, tension, limit or contradiction within the selected concept. A romance about sincere love may reveal a limit of closeness while affection remains; do not jump to breakup, withdrawal or unrelated negativity merely to satisfy the slot. A warning/withdrawal concept may still use withdrawal when warranted.
3. **Sign-specific behavior:** when an action such as apologizing, caring or helping could belong to any sign, replace it with a concrete choice that exposes the selected sign's supported mechanism. Keep the viewer's self-recognition and agency; humor comes from the choice and consequence, not an added unrelated joke. Test against a named alternate sign.
4. **Explanatory compression:** once a behavior has proved a point, the Turn should add only the missing interpretation or a genuine reframe. Delete signposting, redundant setups, restatement and explanatory tails; do not cut an earned emotional or comic beat merely to shorten runtime.
5. **Hook-to-payoff accounting:** if the hook promises N things, identify exactly which early facets deliver them. Later paragraphs deepen, challenge or resolve those facets rather than silently promise a new list. The ending resolves the promise with changed meaning, not a generic moral or obligatory recap. A short callback to the promised items is useful only if it earns the final turn.
6. **Minimal repair and stop rule:** mark beats keep / tighten / redesign with the exact weak excerpt and reason; preserve strong or already accepted wording unless the premise changes. A user-requested revision shows exact before/after changed excerpts (or a unified diff), affected beat IDs and reasons; verify counts from the actual text using the same stated token method for both drafts. No invented retention score or measured duration. Re-check anchors, performance intent, motif and Story Visual candidate decisions for every changed beat, and do not reuse approvals tied to older bytes.

Regression scenarios (mechanisms only, not new scripts): a warm romance draft loses momentum by abruptly switching to a breakup; keep the friction within the love dynamic. A generic apology illustrates little about a pride-centered sign; show an observable cost to the self-image instead. A warm beat already makes the point; the Turn should not explain it three more ways. If the draft has no such defect, keep it unchanged. These are editorial checks, not fixed sign-to-story rules or additional mandatory JSON fields.

Content Review reports the materially weak beats and repairs (or none found), actual paragraph counts, and remaining limitations. The review does not imply that TTS or audience retention has been measured.

## 6d. Profile Fidelity Review (Long and Short Profile)

A profile is a character analysis in spoken form, not a sequence of miniature stories. Specificity comes from observable habits, choices, contrasts and consequences, not necessarily a named setting, object or plot. Situation mode remains available for an explicitly requested situation and keeps its own requirements.

- **Profile-first:** before choosing scenes or motifs, identify the evidence-bounded sign mechanism and the active concept's behavioral contrast. Map distinct facets: what changes in attention, expression, priorities, decisions, communication or vulnerability? Do not invent motives as facts. For relationship contrasts, show the same mechanism with ordinary people and important people, rather than collecting acts of service.
- **Example necessity:** each situation must clarify a specific profile facet that would otherwise be unclear, add a distinct consequence, or carry an earned joke. Brief everyday cues and direct observations are valid; do not make every paragraph a setup/action/resolution sketch. Concrete does not mean staged. Do not create props, settings or incidents because a slot, renderer or motif needs material.
- **Example-removal test:** temporarily remove the setting, prop and incident details from a paragraph. A distinct, recognizable behavioral insight must remain. Substitute another everyday context; the insight should survive. If not, return to Concept/Narrative Design rather than adding a generic explanatory sentence after the sketch.
- **Profile recall test:** after the exact narration, summarize what viewers learn about the sign without retelling examples. If the memorable result is mainly a list of objects or events, repair the underlying facet map. Recognition and named sign-swap still matter.
- **Motif-pressure test:** choose a motif only after the profile map and only if it earns continuity. It may be a verbal contrast or behavioral pattern; direct deconstruction can omit it with a reason. Never reverse-engineer extra examples merely to repeat a motif. The payoff can be a sharp profile reframe without a staged climax.
- **Semantic progression without plot:** advance from observable behavior to contrasting response, cost, private side, trust and reframe. Direct interpretation is useful when new and evidence-bounded. No mandatory micro-scene per beat, ratio of examples, or forced physical action. Preserve good scenes when they genuinely reveal the profile.

Regression: a perfectionism-in-love profile becomes a series about fixing a bag, keys, luggage and cake because the motif demands things to fix. Replace that premise construction with differentiated attention, feedback, standards, friction and vulnerability. An example may remain if it serves a facet rather than the other way around. No fixed sign-to-trait formula, no new required JSON fields, no change to handoff. At Content Review give a short facet map, one removal test and motif decision, and identify any remaining scene dominance.

## 7. Trend phrase pass (optional, at most two phrases)

Natural current speech in a slot that needs it, not slang for its own sake.

1. The writer never calls tools. When a slot needs a current phrase, mark a SEARCH need in the draft. Language research then runs through the Evidence/Concept route in `research-and-viral-tools.md` (Narration step: search by function, never by bulk slang keyword; Parallel Search primary, Exa for deeper discovery, Tavily fallback), and only a sourced language note returns to the writer.
2. Classes follow the existing language taxonomy: `observed` (seen in an accessed source), `recurring` (three independent sites), `trend_candidate` (dated, growth unproven), `measured` (needs platform and time window). A roundup is a phrase corpus, not proof of current use. Language evidence never supports a Zodiac trait.
3. Reject a phrase that sounds forced, stale, text-only or hard to say. Prefer none to a bad one.
4. Record each kept phrase (phrase, slot, function, class, dated sources, why a narrator can say it aloud) in the Content Review summary. Local may keep it as `.authoring/trend-phrases.json` (`zodiac-trend-phrases@1`) and run `node references/validate-trend-phrases.mjs <workspace>`. It is not part of the `zodiac-phase1-handoff@2` inventory and changes nothing in Narrative Plan 2.1.

## 8. Compatibility

Narrative Plan stays `2.1` and the handoff stays `zodiac-phase1-handoff@2`. Every paragraph still gets a beat with an exact `voice_anchor` and `performance`; the skeleton only fixes how many paragraphs there are and what each one does.
