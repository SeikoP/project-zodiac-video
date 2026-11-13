---
name: zodiac-video-web
description: Creative-first Zodiac Phase 1 on ChatGPT Web. Research, design the voice and story, write narration, obtain Content Review, then export one lightweight handoff for Local Phase 2.
---

# Zodiac Video Web

This distribution owns **creative Phase 1 only**. It does not run the native producer runtime.

## Creative microphases

After the user identifies the sign/topic, continue autonomously through these small phases:

1. **Evidence** — research only what is needed to understand the sign mechanism, tensions and useful behavioral interpretations. Prefer two independent useful sources over a large research dump.
2. **Voice** — define narrator attitude, sentence behavior, sharpness, rhythm and any style boundaries from the current request or supplied references.
3. **Concept** — generate genuinely different premises, reject sign-swappable ideas, and select the strongest concept yourself unless the user explicitly asks to choose.
4. **Narrative Design** — build one Story Spine, hook, escalation, reveal/payoff and emotional contrast. For a story-driven concept, choose the **Narrative Motif before Narration** and describe its setup → friction → turn → payoff/callback plus a removal test. Also map the **second-half pulse** so every post-midpoint beat adds action, decision, consequence, contrast, reframe or payoff. A direct deconstruction may explicitly omit a motif with a specific reason. This is semantic Phase-1 design; do not design Phase-2 assets or Visual Metaphors.
5. **Narration** — write for voice and story first. Preserve an opening the user has already accepted unless the story engine itself changes. After the midpoint, keep advancing events, decisions, consequences, reframes or the motif in a changed state; do not let a strong opening collapse into explanation-only paragraphs. Revise for specificity, surprise, spoken flow and payoff; do not optimize against a validator checklist while drafting.
6. **Content Review** — show the final narration plus a compact explanation of the chosen concept/voice. Only the user's explicit approval completes Phase 1.

Do not stop between microphases for routine confirmation.

## Creative-first rule

Phase 1 has **no source-bundle bootstrap, npm/runtime provisioning, native compiler, validator receipt, cache, reuse receipt, performance overlay, or pipeline-state requirement** on Web. Those mechanisms must never block writing.

Use live research tools directly when they improve Evidence. Use installed guidance as creative reference, not as an execution dependency. Quality review is editorial: Zodiac identity, voice fidelity, semantic progression, novelty, hook strength, spoken naturalness and payoff.

There is no mandatory fictional advertisement. Add a parody/product interruption only when the current story benefits from it. If the user disables it, **no stale** parody copy, mock-ad instruction or interruption may remain in the Narrative Plan, Writer Brief, narration, review summary or handoff.

## Revision discipline

Treat the user's diagnosis as a source-edit signal, not a request to polish everything indiscriminately.

- If the **idea/story engine** is rejected, reopen Concept and Narrative Design, then rewrite downstream prose.
- If the opening is accepted but the **later rhythm** is weak, preserve the accepted opening and rebuild the second-half pulse first.
- If humor is requested, derive jokes from the active conflict, motif or narrator reaction; do not add unrelated punchlines that interrupt progression.
- If a recurring image is discovered only after drafting, move it upstream into Narrative Design and re-draft around it rather than pretending it was planned.
- A Phase-1 Narrative Motif is semantic continuity. Never confuse it with Phase-2 Visual Metaphor/Story Object authoring.

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

Prior examples may inspire style only when the user explicitly supplies or selects them. Do not let old episodes, renderer rules, asset catalogues or technical implementation details narrow concept generation.

The handoff preserves creative intent through the approved narration, Narrative Plan, Writer Brief and Voice Profile. Local must continue from those bytes rather than reconstructing the story from chat history.
