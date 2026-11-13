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
4. **Narrative Design** — build one Story Spine, hook, escalation, reveal/payoff, emotional contrast and optional narrative-visual direction. Do not design Phase-2 assets.
5. **Narration** — write for voice and story first. Revise for specificity, surprise, spoken flow and payoff; do not optimize against a validator checklist while drafting.
6. **Content Review** — show the final narration plus a compact explanation of the chosen concept/voice. Only the user's explicit approval completes Phase 1.

Do not stop between microphases for routine confirmation.

## Creative-first rule

Phase 1 has **no source-bundle bootstrap, npm/runtime provisioning, native compiler, validator receipt, cache, reuse receipt, performance overlay, or pipeline-state requirement** on Web. Those mechanisms must never block writing.

Use live research tools directly when they improve Evidence. Use installed guidance as creative reference, not as an execution dependency. Quality review is editorial: Zodiac identity, voice fidelity, semantic progression, novelty, hook strength, spoken naturalness and payoff.

There is no mandatory fictional advertisement. Add a parody/product interruption only when the current story benefits from it.

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

The capsule binds the approved narration and creative context by SHA-256 inventory. `content-review-receipt.json` must come from the actual user approval; use a deterministic `user-message-sha256:<hash>` reference derived from the exact approval text when the host does not expose a stable message ID.

Local owns creation of pipeline state, Phase-2 activation, native validators, visual production and Phase 3. Web must not activate Phase 2.

## Context discipline

Prior examples may inspire style only when the user explicitly supplies or selects them. Do not let old episodes, renderer rules, asset catalogues or technical implementation details narrow concept generation.

The handoff preserves creative intent through the approved narration, Narrative Plan, Writer Brief and Voice Profile. Local must continue from those bytes rather than reconstructing the story from chat history.
