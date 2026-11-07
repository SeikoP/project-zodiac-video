---
name: zodiac-video-web
description: Run Zodiac Phase 1 on ChatGPT Web, obtain genuine Content Review, and export an immutable Phase-1 handoff ZIP for the local producer.
---

# Zodiac Video Web

This distribution owns **Phase 1 only**. Use the canonical implementation under `skills/zodiac-video-pipeline/`; do not duplicate validators or contracts here.

## Invocation

1. Follow `skills/zodiac-video-pipeline/SKILL.md` only for `01-content`: Evidence → Concept → Narration → genuine Content Review.
2. Video Lab and bundled Humanizer may be applied only through the Phase-1 plugin-use contract.
3. After Phase 1 is PASS and Content Review is source-bound APPROVED, run the Phase-2 transition gate with `--entry-only`.
4. Export exactly one handoff capsule with:
   `node skills/zodiac-video-pipeline/phases/phase01/export-phase1-handoff.mjs <workspace> <output.zip>`
5. Deliver that ZIP to the user with status `PHASE1_HANDOFF_READY`.

## Boundary

The Web distribution **must not activate Phase 2** and must not author Visual Intent, assets, previews, Phase 3, Job@5, TTS, timing, Remotion, or MP4. A repository/source transport result is never approval. The exported capsule carries the approved bytes and receipts; local work resumes from those bytes rather than chat history.
