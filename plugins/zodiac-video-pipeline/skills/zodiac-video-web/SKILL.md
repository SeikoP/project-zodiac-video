---
name: zodiac-video-web
description: Creative-first Zodiac Phase 1 on ChatGPT Web. Research, design the voice and story, write narration, obtain Content Review, then export one lightweight handoff for Local Phase 2.
---

# Zodiac Video Web

**Story Visual (hinh ke chuyen)** is an original visual expression of the approved meaning. It may be literal, metaphorical, symbolic, exaggerated, surreal, typographic or a recurring motif, independent of a specific physical situation. Read `skills/zodiac-video-pipeline/references/story-visual-direction.md` before Narrative Design; prefer a meaningful creative image over omission.

This distribution owns **creative Phase 1 only**. It does not run the native producer runtime.

## Creative microphases

After the user identifies the sign/topic, continue autonomously through these small phases:

1. **Evidence** — research only what is needed to understand the sign mechanism, tensions and useful behavioral interpretations. Prefer two independent useful sources over a large research dump.
2. **Voice** — define narrator attitude, sentence behavior, sharpness, rhythm and any style boundaries from the current request or supplied references.
3. **Concept** — generate genuinely different premises, reject sign-swappable or scenario-dependent ideas, run the Recognition & Identity Gate and Audience Alignment Gate below, and select the strongest concept yourself unless the user explicitly asks to choose.
4. **Narrative Design** — build one Story Spine, hook, escalation, reveal/payoff and emotional contrast. Choose the viewer POV and concrete behavioral evidence through the Audience Alignment Gate; use the bundled `zodiac-narrative-mechanics` guidance when choosing or revising the story engine. For a genuinely story-driven concept (not merely a Profile with examples), choose the **Narrative Motif before Narration** and describe its setup → friction → turn → payoff/callback plus a removal test. Also map the **second-half pulse** so every post-midpoint beat adds action, decision, consequence, contrast, reframe or payoff. A direct deconstruction may explicitly omit a motif with a specific reason. This is semantic Phase-1 design. Read `references/story-visual-direction.md`: explore at least two distinct visual candidates, including a nonliteral one, and normally select a compelling episode-level `story_visuals[]` direction or record `story_visual_decision={mode:"omitted",reason:"..."}` recording why the explored literal and nonliteral candidates fail to add clarity, wit, emotion or memorability. Present this decision at Content Review and include it in the approved Narrative Plan. Missing input is not omission. Do not design Phase-2 asset geometry.
5. **Narration** — write for voice and story first. Preserve an opening the user has already accepted unless the story engine itself changes. Keep recognition concrete, interpretation evidence-bounded and progression alive across the whole script. After the midpoint, keep advancing events, decisions, consequences, reframes or the motif in a changed state; do not let a strong opening collapse into explanation-only paragraphs. Revise for specificity, surprise, spoken flow and payoff; do not optimize against a validator checklist while drafting. For a `single_sign` script, choose the narration shape first (see **Narration shape**).
6. **Content Review** — re-run the Audience Alignment Gate on the exact narration and run the dual editorial read below, run the **Duration discipline:** >60 seconds is the normal channel target, not a reason to fill a quota. Estimate from actual spoken text and disclose the counting rate; a 65-90 second planning range is a preference, not a cap or measured retention. Do not add a new situation, repeat a claim, prolong the turn or append a second ending to reach a duration. Choose the shortest complete profile; longer only when additional insight earns it. Actual >60s must be confirmed after TTS; do not alter approved bytes silently.

**Narration shape check**, then show the final narration plus a compact explanation of the chosen concept/voice, the estimated length (flagged if over 120 seconds) and any trend phrase kept with its source. Only the user's explicit approval completes Phase 1.

Do not stop between microphases for routine confirmation.

## Creative-first rule

Phase 1 has **no source-bundle bootstrap, npm/runtime provisioning, native compiler, validator receipt, cache, reuse receipt, performance overlay, or pipeline-state requirement** on Web. Those mechanisms must never block writing.

Use live research tools directly when they improve Evidence. Use installed guidance as creative reference, not as an execution dependency. Quality review is editorial: Zodiac identity, voice fidelity, broad recognition, semantic progression, novelty, hook strength, spoken naturalness and payoff.

There is no mandatory fictional advertisement. Add a parody/product interruption only when the current story benefits from it. If the user disables it, **no stale** parody copy, mock-ad instruction or interruption may remain in the Narrative Plan, Writer Brief, narration, review summary or handoff.

## Narration shape (`single_sign` only)

Read `references/narration-skeleton.md`. Choose **one** mode before drafting and keep it for the whole script:

- **Short profile / compact profile** (default for a one-sign profile): six paragraphs, hook, three distinct concept-led facets, turn, close. Aim just over 60 seconds, normally about 65-90 seconds (roughly 290-405 spoken tokens at 270/min, before pauses); finish as soon as the profile earns its payoff. Explicitly shorter briefs may use shorter scripts. Include friction, private side or warmth only where they add a distinct facet or reframe; no mandatory extra scene.
- **Long profile**: ten paragraphs, only when the concept genuinely needs the additional facets or the user asks for a longer treatment. Its duration band is guidance, never a reason to extend a complete compact profile.
- **Situation**: only when the user explicitly asks for "Khi <cung> + a situation". It is a carrier, so it must pass the Scenario-dependency test in the Recognition & Identity Gate below; if the insight collapses without the situation, use a profile mode.

`element_group`, `comparison` and `ranked_shortlist` do not use these modes. Modes are paragraph layouts inside `character_deconstruction`, never a new Story Shape. `references/style-references/profile-structure-references.md` shows the shared shape of three reference subtitles: use it for structure and pacing only, never to copy wording, never as Zodiac evidence, never inside a Writer Brief.

**Narration shape check** (editorial, by hand; Web runs no validator): paragraph count matches the mode; the hook promise lands by token 16 with no greeting; every section does a job no earlier section did; each required slot has an outside-versus-inside turn; no paragraph past its ceiling (profile sections stay within the 90-token pull gap) and no sentence past one breath; the close returns to the hook's words with a changed meaning and has no goodbye, recap or call to action; the estimated length is stated as an estimate. Name any limit you knowingly exceed and why.

**Trend Phrase Pass** (optional, at most two phrases): the writer never calls tools. Mark a SEARCH need where a slot wants a current phrase; language research runs through the Evidence/Concept route in `references/research-and-viral-tools.md` (search by function, dated sources, `observed` / `recurring` needs three independent sites / `trend_candidate` / `measured`), and only a sourced language note returns to the writer. Keep a phrase only if it is natural to say aloud for this narrator; prefer none to a bad one. Language evidence never supports a Zodiac trait. Report kept phrases in the Content Review summary. They are not a handoff artifact, and Narrative Plan 2.1 and `zodiac-phase1-handoff@2` are unchanged: still one beat per paragraph with an exact `voice_anchor`.

**Profile Fidelity Review** (required for Long/Short Profile; see section 6d of `narration-skeleton.md`): at Concept choose the profile's evidence-bounded behavioral mechanisms before settings, props or motif. At Narrative Design map ordinary-person versus important-person behavior (or the active concept's contrast), distinct profile facets and the reason any example is necessary. Prefer direct, vivid behavioral description and brief recognition cues; a concrete behavior is not a demand for a staged scene. Examples illustrate a profile claim and remain replaceable. A profile can progress through new insight, contrast, consequence or reframe without a sequence of events. At Content Review run the example-removal, profile recall and motif-pressure tests on the actual narration. If the profile disappears when examples are removed, or the motif is generating events to fill slots, reopen Concept/Narrative Design. Do not turn this into a ban on scenes or a numerical quota. No additional artifact or approval gate.

**Narrative Economy Review** (required editorial check, see section 6c of `narration-skeleton.md`): inspect the actual narration for padding, generic behavior, topic drift, duplicated explanation and hook-payoff mismatch. Give every paragraph a distinct semantic gain; use a deletion test on weak lines. Repair the weakest beats only, preserve strong lines, and stop when the draft earns its length. Lower token targets never justify filler. Dark Side must expose a cost, friction or limit of the active concept rather than force a different topic. A counted hook must pay off each promised item; the close changes its meaning rather than mechanically reciting the list. If a revision is requested, show a before/after diff for changed beats with reasons, actual counts using one stated counting method, and refresh all affected anchors, motif and Story Visual directions before review. If no material defect exists, retain the exact draft. No new artifact, score threshold or native approval mechanism.

**Content Review evidence** (see section 6b of `narration-skeleton.md`): show the per-paragraph token table, name the swap sign in the sign-swap test, list audio-only defects found and fixed (referents, fragment ordinals), give the trend search status (`searched: yes/no`), and run the Story Visual candidate review (at least two candidates, the failed condition for each) before choosing `omitted`. Carry the Narrative Motif in the Writer Brief `motif_candidates`, never in Narrative Plan 2.1.

Foreign words such as "online" stay in the narration; note their intended reading instead of rewriting natural speech.

## Recognition & Identity Gate

Before selecting a Concept winner, challenge the premise editorially. This is an internal design test, not a new runtime artifact or a requirement to narrate every test case.

- **Behavior core** — describe the recognizable behavior with the chosen school/work/romance/deadline/travel scenario removed. If only the scenario remains, the premise is too narrow.
- **Broad recognition** — a viewer who has never lived the selected scenario should still be able to recognize the behavior in themselves or someone they know.
- **Multi-context test** — the same behavior core should remain natural in at least three materially different everyday contexts. Use this only to test portability; do not turn the final narration into a list of three examples.
- **Scenario-dependency test** — remove the selected situation. If the Zodiac insight or payoff collapses with it, reject or redesign the premise before Narration.
- **Sign ownership** — run a sign-swap counterfactual. A strong premise changes materially when another plausible sign replaces the selected sign.
- **Scene dominance** — reject a premise when the plot, setting or situation becomes more memorable and meaningful than the Zodiac lens.
- **Moral drift** — reject a generic redemption, friendship, teamwork or life-lesson arc that would still work nearly unchanged without the sign.

Specificity must come from the selected sign's behavioral mechanism, not merely from a specific prop, deadline, classroom, office or unusual life event.

## Audience Alignment Gate (required editorial check, not a new phase)

The channel owner reports a predominantly female audience. Treat this as an owner-supplied working audience profile, not measured analytics or Zodiac evidence. The current user's explicit episode audience/POV overrides this default. Do not invent demographic percentages or infer gender-specific traits. Keep content accessible to other viewers.

- **Viewer POV** — at Concept, choose self-identification (default for sign-led episodes), recognizing someone else, or observing a relationship dynamic when the premise calls for it. Specify whose behavior the viewer should recognize and why, in existing Writer Brief prose. Do not default to describing an ideal boyfriend/girlfriend from the partner's viewpoint.
- **Role bias test** — examine the combined hook, actions, choices and payoff, not just pronouns. Would viewers still naturally recognize themselves in the focal character if gender labels were removed or changed? Look for a sequence that assumes one partner always plans dates, drives, pays, initiates, provides, protects, or passively receives care. These actions are not inherently gendered; reject reliance on a culturally narrow role only when it undermines the chosen audience POV. An explicitly gendered premise may keep its intentional specificity.
- **Behavioral alternatives** — before selecting the story spine, consider at least two materially different ways to express the same sign-specific contradiction. Select concrete choices across everyday contexts when useful: voluntary inclusion, sharing an experience, making room in a routine, teasing, admitting vulnerability, changing a decision, or a meaningful physical action. Do not replace all date-planning stories with texting, jealousy, waiting for replies, or any other stock "female" trope. Preserve agency, humor and sign ownership.
- **Recognition payoff** — ask whether the intended viewer can think "giống mình" from what the focal character actually does, without needing to imagine being the other partner. If the chosen POV is deliberately other-recognition, test that POV instead. Ensure the payoff is about the sign's contradiction, not a generic standard of a good partner.
- **Review and repair** — before Content Review, inspect the exact spoken script for cumulative role bias, viewer POV drift, sign identity and diverse meaningful evidence. If it fails, reopen Concept/Narrative Design and replace the underlying evidence and payoff; changing pronouns alone is not a repair. Recheck progression, single-voice TTS and Story Visual after revision. Summarize the chosen POV and concrete reason in existing review/Writer Brief prose; no new mandatory JSON fields or runtime validators.

Regression example (love-sincere / Sagittarius): a sequence centered only on planning dates, arranging pickups and scouting restaurants may leave a female-majority self-identification audience observing a partner rather than recognizing themselves. Preserve the premise (independence vs voluntarily making room for someone) but test more varied behavior: a spontaneous discovery becomes something to share, a private routine is opened to another person, and a choice or joke reveals that independence now includes companionship. A date plan can still be the strongest beat when it follows from that contradiction. Do not hardcode these examples to Sagittarius or turn them into the next fixed formula.

## Evidence and motive boundary

Show behavior before interpretation. Keep factual Zodiac claims grounded in Evidence and keep editorial inference visibly bounded.

- Do not state an **unsupported motive**, inner cause, diagnosis, guaranteed outcome, statistic or universal claim as fact merely because it makes the story cleaner.
- Prefer observable action and restrained interpretation over mind-reading. A useful reframe may explain how a behavior can be read without claiming to know why every person does it.
- Strong banter, exaggeration and sharp phrasing may heighten delivery, but they do not expand the evidence boundary.

## Engagement and progression

Read `skills/zodiac-video-pipeline/references/engagement-engine.md`. For fresh episodes apply engagement-design@2 editorial interaction design before writing: `comment_move`, `share_target`, `quotable_line` (4-25 words, verbatim in narration) and `replay_seam`. During Content Review check all four against actual spoken excerpts, repair failures, and carry the intent in the existing Writer Brief. Web remains guidance-only: do not invent native validator receipts or expand the handoff contract.

For fresh episodes apply the **Spoken interaction design** section in the bundled engagement-engine reference before drafting. Present the four-field Interaction Check with exact spoken excerpts and beat IDs at Content Review; unresolved REVIEW blocks approval. Carry the design and check in existing Writer Brief prose, not a new artifact.

**Recognition is not progression.** Several relatable examples that prove the same trait still perform one semantic job.

Across the whole script, not only after the midpoint, each new beat should add at least one of: action, decision, consequence, useful question, contrast, reframe, callback or payoff. Two adjacent explanation-only beats are a redesign signal unless the second genuinely changes the interpretation or closes a setup.

Do not rescue a weak premise with a louder hook, imagined editing, fake mystery or a long list of recognition cues.

## Emergent narrative archetypes

Use **behavior first, label second**. A story may naturally behave like a detective case, interrogation, mock documentary, chat reconstruction or another recognizable mode when the actual behavior supports it.

When using such an archetype:
- keep the viewer-facing role label implicit so the audience can supply the inference themselves;
- do not permanently map one Zodiac sign to one narrative mode;
- do not import raw comments or viewer labels as Zodiac evidence;
- repeat a recently used mode only when the underlying behavior and story warrant it.

The success condition is that viewers can infer a fitting role from the behavior, not that Narration announces the role for them.

## Revision discipline

Treat the user's diagnosis as a source-edit signal, not a request to polish everything indiscriminately.

- If the **idea/story engine** is rejected, reopen Concept and Narrative Design, then rewrite downstream prose.
- If broad recognition, Audience Alignment, sign ownership, scene dominance or motive boundaries fail, repair Concept/Narrative Design before polishing sentences.
- If the opening is accepted but the **later rhythm** is weak, preserve the accepted opening and rebuild the second-half pulse first.
- If humor is requested, derive jokes from the active conflict, motif or narrator reaction; do not add unrelated punchlines that interrupt progression.
- If a recurring image is discovered only after drafting, move it upstream into Narrative Design and re-draft around it rather than pretending it was planned.
- A Phase-1 Narrative Motif is semantic continuity. Never confuse it with Phase-2 Visual Metaphor/Story Object authoring.

## Physical situations in Narrative Design

In Profile modes, start from the profile facet; use a situation only if it clarifies or earns a distinct contrast. When the premise benefits from a concrete situation, let the approved story contain an object someone actually uses, a physical obstacle, and the resulting choice or consequence. One familiar item can return with changed meaning. Carry this action in the Story Spine and beat purpose; do not design assets, coordinates, contacts or a Phase2 prop quota.

Keep direct or reflective episodes sparse when physical staging adds nothing. Never force a school, office, car, cake, deadline or asset-catalog example into an unrelated sign merely because it is easy to visualize. Local translates approved physical actions into interactive props and scene direction.

## Dual editorial read before Content Review

The script must survive both listening without the screen and reading without imagined performance.

### Single-voice TTS editorial review

Write for a listener who cannot see quotation marks or the screen. Default to one narrator. Identify a speaker before every necessary quotation; convert repeated dialogue, unlabelled thoughts and question/answer chains into narrated action. Dialogue is optional, not a quota. Do not rely on the engine changing voice, punctuation alone creating a dramatic pause, or performance metadata controlling prosody.

Before Content Review, make an **audio-only editorial pass**: track who acts/speaks, where the action happens, time jumps, cause and consequence, pronoun referents, breath-length clauses, repeated explanations, spoken numbers/abbreviations/foreign words, text-only jokes and the ending. Prefer concrete verbs and short connected sentences; vary sentence length naturally. Make essential signs/captions understandable in spoken narration. Keep stage directions and SSML out of narration.txt. Estimate duration and disclose it as an estimate.

Carry speaker strategy, transitions, emphasis and unresolved pronunciation risks into Voice Profile and Writer Brief. Actual synthesized audio still needs listening before TTS performance approval. On revision, show the exact revised narration and invalidate approvals tied to changed bytes; do not carry approval of a previous draft forward.

### Silent-read editorial review

Read the final narration while deliberately ignoring TTS delivery, music, captions, animation, cuts and visual acting. The text itself must preserve premise clarity, recognition on the page, progression without performance, a legible contradiction/reframe, payoff without audiovisual help, ending energy and sign irreplaceability.

If a weak paragraph only becomes interesting after imagining a voice actor, sound effect, zoom, caption reveal or edit, revise the owning Concept/Narrative Design/Narration layer instead of asking Phase 2 to rescue it.

## Runnable narration-performance plan before Content Review

For a fresh Web-authored handoff, `narrative-plan.json` must use `version: "2.1"`. A format-like label is not a substitute for the required `version` field.

Before Content Review, bind the approved narration to non-empty semantic `beats`. Every beat that carries spoken performance intent must include:
- a stable `id`;
- an exact `voice_anchor` present in `narration.txt`;
- `occurrence` when the same anchor appears more than once;
- `performance.delivery`, `energy` (0..1), `emotion`, `pace` (slow/medium/fast), `emphasis[]`, and `reason`.

Use the smallest set of beats that preserves the actual semantic/performance changes in the approved narration. Performance intent is authored in Phase 1; it is not a Phase-2 invention. Local may map approved beats to scene boundaries at authored paragraph seams. Do not invent a missing beat, anchor, occurrence, delivery, energy, emotion, pace, emphasis, or reason in Local and then treat that data as approved.

Run the anchor/occurrence/performance check **before Content Review**. If a later scene split cannot be covered by the approved beats, Local must block and request supplementary review rather than manufacture coverage. Do not add or rewrite performance beats after Content Review while retaining the old approval receipt; any plan-byte change invalidates the plan hash and requires genuine approval again.

## Minimal handoff

After genuine Content Review approval, create exactly one `zodiac-phase1-handoff@2` ZIP using the host file tools available in ChatGPT. Do not require Node or the native producer runtime.

Required payload:
- `narration.txt`
- `narrative-plan.json`
- `episode-scope.json`
- `writer-brief.json`
- `voice-profile.json`
- `content-review-receipt.json`
- `HANDOFF.json`
- `SHA256SUMS`

The capsule binds the approved narration and creative context by SHA-256 inventory. Create `content-review-receipt.json` **at the moment of approval** with SHA-256 hashes for `narration`, `plan`, `scope`, `brief`, and `voice`; export must reject any later drift. The receipt must come from the actual user approval. Use a deterministic `user-message-sha256:<hash>` reference derived from the exact approval text when the host does not expose a stable message ID.

Local owns creation of pipeline state, Phase-2 activation, native validators, visual production and Phase 3. Web must not activate Phase 2.

## Context discipline

Prior examples may inspire style only when the user explicitly supplies or selects them. Use a **style-only firewall**: transfer narrator stance, relationship, cadence, sentence behavior, comic mechanisms, controlled roughness and emotional movement only. Do not transfer Zodiac claims, reference-specific situations as facts, exact jokes, distinctive phrases, exact sentences, or unsupported motives/outcomes from a style source.

Do not let old episodes, renderer rules, asset catalogues or technical implementation details narrow concept generation.

The handoff preserves creative intent through the approved narration, Narrative Plan, Writer Brief and Voice Profile. Local must continue from those bytes rather than reconstructing the story from chat history.

## User says chốt

Treat chốt as an instruction to finish validation and repair the current phase, never as a validator waiver. Run the owning checks against current sources, fill omissions and repair failures, then validate again. Missing input, REVIEW, BLOCKED, stale receipts or incomplete required outputs prevent phase transition even after chốt. Keep the user's approval intent while doing this work; do not ask for the same confirmation merely because checks had to run. Bind an APPROVED receipt only after the current reviewed creative sources and required checks pass. If a repair changes the reviewed creative meaning, present the concrete revision for review; never transfer approval to unseen content. Technical checks do not replace source-bound content/visual inspection.
