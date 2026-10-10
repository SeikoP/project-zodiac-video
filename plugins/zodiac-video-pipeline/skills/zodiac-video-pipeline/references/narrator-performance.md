# Narration step — performance-first writing

The Narration step inside Phase 1 Content writes the complete narration from a small creative brief. It must not sound like a planner reading its outline.

## Story quality ownership

Narration is not allowed to rescue an uninteresting Concept with faster jokes or emotional voice. The selected concept must have passed candidate competition before the writer receives its small brief. After writing, a separate editorial challenger runs `content-quality-engine.md` and `validate-story-quality-review.mjs` before Content Review. If the actual story lacks a worthwhile turn, recognizable stakes, specific insight or earned payoff, go back to Concept; do not polish the same narration indefinitely.

## Context boundary

The writer receives:
- Narration Writer Brief;
- minimal evidence needed to stay claim-safe;
- compact Viral writer effects already selected by Concept;
- compact compiled reference mechanics when present.

The writer does **not** receive:
- raw attachment/SRT/reference;
- full narrative plan;
- full evidence ledger/research;
- QC checklist;
- asset library;
- interaction schema;
- renderer/runtime/package context.

The brief carries the creative direction that matters: content engine, identity tension, progression intent, payoff target, compressed Viral writer effects and compressed reference mechanics.

## Common spoken Vietnamese

Write for speech:
- natural Vietnamese syntax;
- varied sentence lengths;
- clear referents;
- controlled interruptions/reactions;
- concrete wording before abstract explanation;
- transitions that sound spoken rather than essay-like.

Do not force slang or a student-life register. Audience vibe comes from the concept/reference.

## Narration cleanliness lock

Planning vocabulary is internal scaffolding, never spoken copy. Translate the plan into ordinary Vietnamese before returning narration.

Hard-fail narration when internal/meta vocabulary leaks into the spoken script, including standalone English terms such as `concept`, `evidence`, `claim`, `payoff`, `narrative`, `criticism`, or artifact labels such as `Story Spine`, `semantic delta`, `viral analysis`, and `writer brief`.

Bad: `Đó mới là chỗ concept này thú vị.`
Good: `Và từ đây, cái kiểu “hay chỉnh” bắt đầu nhìn hơi khác.`

The writer may use the underlying idea, but must never comment on the content plan itself. Do not say that a concept is interesting, a claim is supported, evidence says something, a payoff is coming, or a narrative is changing.

## Common evidence boundary

Performance can alter framing, fictional dialogue, staging, diction, rhythm and narrator reaction.

It cannot invent unsupported:
- motive;
- cause;
- consequence;
- frequency;
- outcome;
- psychological explanation.

When evidence supports behavior but not inner cause, describe what can be observed.

### Intensity without claim drift

Make the narration stronger through:
- a sharper identity frame;
- contrast;
- reversal;
- diction;
- rhythm and sentence breaks;
- recognition;
- cumulative synthesis/payoff.

Do not make it stronger by upgrading a modest supported tendency into an absolute, diagnosis, hidden motive or guaranteed outcome.

## Deconstruction performance

Use for `character_deconstruction`.

The narrator may lead the entire piece. Interaction is optional.

Useful movement:
`claim/observation → concrete manifestation → supported contrast/reversal → next facet → cumulative synthesis`.

Rules:
- each facet must reveal something genuinely new;
- a concrete manifestation can be one behavior/image, not necessarily a full scene;
- use contrast/reversal when evidence supports both sides;
- let a later facet revise the viewer's earlier read;
- do not explain the same trait repeatedly with new synonyms;
- converge toward the payoff target rather than ending as a list.

Reference mechanics may influence cadence, facet sequencing, reversal timing and recognition payoff. They may not import the reference's claims.

## Scene performance

Illustrative mini-scenes remain inside Character.

Prefer:
`character acts → another person/situation responds → state changes → narrator catches/reframes → story moves`.

When 2+ people are present, the secondary character should change the situation rather than only supply information.

After a scene already proves the point, use at most one useful reframe/reaction before moving on. Do not paraphrase the scene several times.

## Keep the script alive

Depending on delivery mode, use:
- abrupt short reactions;
- pauses;
- quick questions;
- small callbacks;
- dialogue that exposes the insight before narration names it.

Controlled roughness is acceptable. Do not polish every transition into an essay.

## Post-write semantic QC

After the **full narration exists**, create `narrative-qc.json`. This is a soft semantic review, not a regex scorecard.

Evaluate:
- `facet_novelty`: do major sections add distinct meaning?
- `progression`: does the viewer's understanding actually move?
- `identity_coherence`: do facets remain tied to the Story Spine?
- `sign_specificity`: would this still read as the selected sign/topic rather than generic personality copy?
- `recognition_strength`: are concrete manifestations recognizable without inventing claims?
- `payoff_convergence`: does the ending synthesize what came before?
- `reference_mechanic_match`: when a reference exists, were its mechanics transferred without copying claims/lines? Use N/A when none exists.
- `repetitive_paraphrase`: are several passages restating the same facet?
- `planner_language_cleanliness`: does every line sound like viewer-facing speech rather than internal planning/QC language?

Result values are `PASS`, `REVIEW` or `N/A` where explicitly allowed. **Do not default to PASS.** If a reasonable reviewer could point to a concrete weakness, mark `REVIEW`, write the issue in `revision_targets`, revise the narration, and run semantic QC again.

`narrative-qc.json` must also contain:
- `decision: PASS | REVIEW`;
- `revision_targets: []` when PASS, otherwise concrete revision targets.

Critical fields are `facet_novelty`, `progression`, `identity_coherence`, `sign_specificity`, `recognition_strength`, `payoff_convergence`, `repetitive_paraphrase`, and `planner_language_cleanliness`. Any `REVIEW` in a critical field forces `decision=REVIEW`. Content Review cannot open until `validate-narrative-qc.mjs` passes and the `narrative_qc_decision` gate is PASS.

Pay special attention to two common false-PASS patterns:
- **motif substitution:** the same metaphor/prop keeps rephrasing one idea instead of adding a new facet;
- **analysis voice:** abstract phrases explain the trait after the behavior already proved it. Prefer another observable behavior or cut the explanation.

These are semantic judgments. Do not pretend to measure them with fixed keyword counts.

## Writer self-edit

Before returning Narration:
1. read aloud;
2. remove article-like explanation;
3. remove planner/meta-language and translate planning concepts into natural viewer-facing speech;
4. check every major passage against progression intent;
5. cut repeated paraphrases and reduce motif reuse when it replaces semantic progression;
6. replace abstract trait-analysis with observable behavior where possible;
7. verify every strong line stays inside the evidence boundary;
8. verify reference influence is mechanical, not copied content;
9. keep one convergent synthesis/payoff instead of explaining after every facet/scene.

Do not run Visual Compile from the Narration step.
