# Topic banter / Tám chuyện — Zodiac character delivery v2.2.29

## Intent
Deliver Zodiac personality analysis as a narrator who is *tám chuyện với người xem*: notices something recognizable, reacts in a human voice, teases an interpretation, and naturally returns to the core character insight. Preserve insight and evidence boundaries. This is a conversational **texture** on top of `character_deconstruction`, not `micro_story`, not a fourth shape, and not mandatory second-character dialogue.

## Editorial recipe (optional moves, not beat template)
- **Gossip-like observation:** a lively, specific social observation related to the chosen personality facet; avoid factual gossip about real persons.
- **Narrator aside:** brief quip or playful self-correction grounded in what was just described.
- **Viewer complicity:** a direct question or 'biết kiểu người này không?' that invites recognition and leads to new content.
- **Scenelet:** brief imagined everyday detail to *illustrate*, not replace, the analytical claim.
- **Callback/reinterpretation:** reuse an earlier funny or recognizable detail to deepen tension or payoff.

**Progression requirement:** `substantive insight → topic-specific aside/reaction → new evidence-safe angle or reframe`. Conversation is woven through the flow; never append a standalone 'tám chuyện' segment. No fixed number, proportion, time allocation or filler. If a quip can be deleted with no loss of voice, recognition or progression, improve or remove it. The default delivery mode for a new, character-led Zodiac narration is `conversational` unless the user has explicitly selected `direct` or the research/concept demonstrably requires a precise direct style; record the choice in the existing plan rationale without inventing schema fields.

## Example: Song Tử (illustrative fictional framing, not research evidence)
'Mới hôm qua còn gật đầu với phương án A, hôm nay Song Tử lại hỏi: ủa, sao không thử B? Nghe là muốn hỏi ngay: rốt cuộc cậu đứng phe nào? Nhưng khoan, phần thú vị nằm ở chỗ: họ đang đổi phe, hay chỉ đang thử một góc nhìn mà cả nhóm bỏ sót?'
The banter is the speaker's reaction to the same topic and introduces a meaningful reinterpretation. It never asserts that all Gemini behave this way.

## Failure modes to reject during Phase 01 review
- **Generic chatter:** jokes, empty rhetorical questions or reactions interchangeable across all zodiac signs.
- **Analysis interruption:** a new tangent makes the audience forget the identity tension.
- **Formula tic:** mechanically placing a joke after every beat or repeatedly saying 'nói thật nhé', 'ủa', 'khoan'.
- **Manufactured claims:** gossip treatment introduces unsupported motives, consequences, generality or psychological diagnoses.
- **Shape drift:** adding imagined dialogue leads the agent to pick hybrid/micro_story without a real event-driven need.
- **Weak payoff:** banter is memorable but closing synthesis is a generic compliment.

## Workflow / QC
Concept chooses shape from character-first rule **before** hook/viral analysis. The minimal writer brief contains only 1–2 compact performance cues such as 'narrator chats about topic, notices and riffs before deepening the character insight'; do not paste this full document into writer context. Post-write editorial QC evaluates specificity, integration, genuine semantic deltas, payoff return and stable shape. Mark REVIEW for off-topic filler or unsupported claim drift. Existing evidence/narrative validators remain authoritative; this human semantic QC supplements them and generates no fake automated PASS. Approved narration/shape stays locked. No phase/schema/Job@5 changes.


## Strong banter v2.2.30 — opinionated conversational performance
The old layer's brief aside/reaction is insufficient when it only decorates an analytical monologue. For fresh Zodiac character narrations, default to **opinionated gossip**: narrator has a concrete view about the CURRENT topic, addresses a recognizable misconception, pushes back against an easy conclusion and occasionally teases the character. The banter must be substantive enough to change the viewer's interpretation, not just add a question.

Performance moves (select adaptively, not a script):
- **Take a position:** voice a clear but bounded reading of the topic, not generalized attacks or invented facts.
- **Tease the reading:** lightly mock the *interpretation* or relatable behavior; do not mock a vulnerable person.
- **Argue with an imagined viewer:** introduce the strongest natural objection, then respond with supported behavioral distinction.
- **Change sides mid-thought:** acknowledge when the other reading has merit, with actual evidence.
- **Reveal a cost or boundary:** explore the tension a trait creates without asserting unsupported real-world effects.
- **Earn a callback:** an earlier phrase returns at a deeper meaning rather than repeating the joke.

Use a verbal point of view, varied pacing and topic vocabulary. Narrator can speak as if they are discussing someone with the audience without inventing biographical gossip. Narrator-led character deconstruction remains the shape; no need for dialogue partner or full mini-story.

Reject any narration where all gossip lines can be removed without changing engagement, argument or synthesis. Reject redundant 'ủa/khoan/nói thật' filler, endless question chains, random sarcasm, a string of unrelated scenes, exaggeration passed as evidence or a shallow final moral. One meaty objection-and-reframe can be stronger than four quips. Banter is never a substitute for identity tension, evidence and differentiated facets.

## Delivery palette
A analytical storytelling: careful observation and supported interpretation.
B friendly gossip: warmth, recognizable detail, social talk.
C opinionated gossip (opt-in only): take + playful rebuttal + counter-reading + substantive reframe.
D dramatic contrast: juxtapose two supported faces of an identity tension.
E playful character roast: short recognizable exaggeration immediately contextualized by a real insight.
Choose B Friendly Gossip as the user-selected default within `delivery_mode: conversational`; do not silently replace B with C. Strong banter means topical specificity and natural social momentum, not mandatory argument or confrontation. The palette is NOT a new story-shape enum or a required schema field. An explicit user-selected delivery overrides the default. Existing `direct` remains supported.


## AUTHORITATIVE UPDATE v2.2.31 — B Friendly Gossip + backgroundless banter ONLY
The user's explicit choice overrides earlier default C: use **Delivery B / Friendly Gossip** for fresh Zodiac character narrations. It should feel like a friend telling a lively, recognizable observation with warmth and small reactions; occasional objections or a contrast are optional, never the compulsory C confrontational architecture. Every substantial aside must stay on the current character insight and bring recognition or a fresh facet. Never pad with generic phrases.

Visual-specific ownership is in `references/banter-visual-scope.md`. **Only banter moments** omit background/environment structures; all other layers keep their original native V4 backgrounds. Props/effects are semantically animated story participants, not passive decoration or background substitutes.

## v2.2.32 compatible storytelling boundary
Delivery B Friendly Gossip is the selected default for Zodiac. Narrative subtext, quiet observation and poignant payoff are compatible with this delivery. Never turn that into forced C opinionated rebuttal or select `micro_story`. Friendly Gossip remains a performance layer, and only its topic-banter moments omit environmental backgrounds; other narrative facets keep their existing backgrounds.

Current rule: only `character_deconstruction` can be selected for NEW Zodiac; older hybrid/micro wording is obsolete. See `character-depth-v2.md`.
