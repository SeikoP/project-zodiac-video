# Narrative delivery modes

Story shape and delivery mode are orthogonal. Do not turn this document into a new rigid template.

## Mode A — Direct

Use when the core insight already has enough stop-power and clarity, when the material is primarily explanatory, or when riffing would dilute a precise evidence-bounded point.

Direct can still contain one reaction, one joke, one micro-scene, or an interaction. It simply does not depend on conversational interruption for its rhythm.

Typical feel:
`Hook → insight/story → development → payoff`

Do not force banter into Direct just to vary the format.

## Mode B — Conversational

Use when the approved evidence naturally supports recognizable micro-behavior, relationship dynamics, a visible tension, or a contradiction/reversal that can be staged.

The target feeling is that the narrator is talking **with** the viewer: noticing, interrupting, teasing, questioning, then returning to the insight.

### Opening contract

Name/identify the sign or topic early. Do not hide the topic behind a mini-story reveal. The validator requires one configured sign label/alias within the first 40 normalized narration words; this is a generous anti-delay gate, not a target length.

The opening may riff, but no more than three leading riff-only beats may occur before substantive evidence/micro-scene content begins.

### Banter is a layer, not a section

Do not write:
`BANTER SECTION → ANALYSIS SECTION`.

Instead, small conversational moves can recur between content beats:
- cà khịa nhẹ;
- “ủa?”, “khoan”, “rồi sao?”;
- narrator side-comment;
- catching a character contradicting their own displayed behavior;
- brief callback.

Narrator reaction is punctuation. Three reaction-only beats in a row should trigger review.

### Micro-scenes

Prefer small concrete situations over abstract trait explanation. A micro-scene is usually one readable exchange or behavior:
`setup → action → response → reframe/punch`.

The 5–12 second range is a pacing heuristic, not a validation rule.

Reset into another situation when it adds a new facet/context. Do not repeat the same joke with a different prop.

### Contradiction Comedy primitive

When evidence genuinely supports a tension:
`CLAIM / STANCE → BEHAVIOR → CONTRADICTION → NARRATOR PUNCH`.

A contradiction beat MUST carry:
- evidence references;
- a short `contradiction_basis` explaining what supported tension is being staged.

Do not manufacture an opposite behavior simply because contradiction is funny.

### Interaction-first storytelling

When two people affect one another, narrative planning should create a relational beat before Visual Compile. Mark the beat with device `interaction` and an `interaction_id`.

Visual Compile then turns that intent into the existing Interaction Choreography contract:
- initiator;
- responder;
- shared prop/focus if present;
- initiative → response order;
- ownership/anchor/spatial changes when relevant.

The renderer does not invent relationships from static narration.

### Escalation

Later micro-scenes should change at least one meaningful dimension:
- context;
- relational state;
- emotional/social cost already supported by evidence;
- a distinct facet of the same thesis;
- payoff/callback.

Do not use “bigger insult” as escalation.

## Evidence boundary

Humor may modify:
- framing;
- fictional dialogue;
- staging;
- narrator reaction;
- the intensity of wording within an already-supported idea.

Humor may NOT introduce unsupported:
- motive;
- cause;
- consequence;
- frequency;
- outcome;
- psychological explanation.

Every narrative-plan beat is classified as `SOURCE-SUPPORTED`, `EDITORIAL EXAGGERATION`, or `FICTIONAL MICRO-EXAMPLE`, and every beat carries at least one `evidence_ref` back to the approved evidence boundary.

## Planner decision

Prefer Conversational when several of these are true:
- there is a recognizable micro-behavior;
- the topic naturally creates an action/reaction exchange;
- a supported contrast or contradiction exists;
- another character can meaningfully respond;
- the insight benefits from recognition/comedy more than explanation.

Prefer Direct when several of these are true:
- one strong insight already carries the hook;
- the point needs precision or clean explanation;
- evidence does not support a contradiction;
- interaction would be decorative;
- added narrator personality would slow the point.

Never choose a mode only to alternate templates.

## QC philosophy

Hard validation catches objective drift:
- sign/topic delayed beyond the generous opening window;
- too many leading riff-only beats;
- contradiction without evidence/basis;
- interaction beat whose ID cannot resolve to the interaction plan;
- malformed authoring plan.

Soft review handles subjective quality:
- narrator reaction feels spammy;
- micro-scenes feel repetitive;
- joke is generic enough to fit any sign;
- escalation does not feel stronger/different;
- voice is too mean, too stand-up, or too lecture-like.

Do not turn soft review into fixed counts.
