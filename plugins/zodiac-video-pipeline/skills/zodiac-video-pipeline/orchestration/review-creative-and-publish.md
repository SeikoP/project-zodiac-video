# Post-audit quality gates — editorial, identity, cover and publish

These are review obligations inside the existing three phases, not a new phase. Never replace human creative approval with deterministic PASS or fabricate compiler/render receipts.

## Phase 01 — final text pass
- Separate premise strength, Zodiac-specific logic, progression and payoff from narration delivery. Test sign-swap, moral-arc drift, scene dominance, semantic delta by beat and speakability once through VieNeu where available.
- Flag unintentional gender assignments (`thằng`, `con bé`, `anh chàng`, `cô nàng`, `con trai`, `con gái`) in narrator, subtitle, hook, cover and publish text. Context-specific named-character dialogue may justify them; review rather than indiscriminately replacing words. Do not change approved narration silently. Recompute anchor hashes and obtain revision approval on semantic changes.
- Use plain spoken narration for TTS; **markdown bold** belongs to UI and never enters narration.txt or voice anchor. Voice anchors must be exact whole-word text fragments.

## Phase 02 — visual intent authoring
- Director Plan documents primary actor, head-space Story Object, before→after visual meaning, supporting prop/crowd/reaction/effect opportunities, density rationale and why each role is used or omitted for every beat.
- The Story Object is a changing metaphor in thought-space when semantically appropriate, *not* a background replacement nor ordinary decoration. Test voice-muted setup→friction→payoff and actual temporal changes. Do not enforce prop-count quotas or one-SVG-per-line.
- Scene environments are motivated by the narration, not convenience profiles. Symbolic minimal thought-space is valid; do not add sofa/window to satisfy fixture counts. Validate token V4, handwritten strokes, casting diversity across completed series, face visibility, caption safe zone, 180px-scale cover legibility and scene-to-scene composition diversity.
- Run `node orchestration/audit-visual-story-roles.mjs <workspace>` after authoring events/assets and BEFORE native visual review; record its REVIEW_REQUIRED findings. REVIEW flags are editorial questions, not automatic failures and not proof of quality. Unresolved asset references/event targets block.
- Changes to narration, assets, events, cover or publish surfaces after an approval require a source revision diff and *new approval for affected surfaces*; do not inherit v3 review for v1.1/v1.2 revisions.

## Phase 03 — publishing and runner boundary
- Publish Prep may target 8–12 relevant TikTok hashtags and 5–8 Shorts hashtags, configurable and not a platform guarantee. Tags may repeat across videos; deduplicate exact duplicates *within* a post. If too few relevant tags exist, emit fewer with an explicit reason. Never put hashtags in TTS, caption overlay or cover.
- Before release, triage **every** semantic P2 warning: FIXED or WAIVED with scene, risk, rationale and evidence. P1=0 alone is not a video approval.
- Plugin ZIP/contract PASS cannot certify actual VieNeu WAV timing, rendered subtitle/cover glyphs, effect lifecycle, MP4 continuity, last-word hold or runner parity. Obtain local runner playback evidence for opening, middle and end and retain hashes and logs.

## Revision-impact executable
Compare the actually approved source workspace and candidate revision before sealing: `node orchestration/assess-revision-impact.mjs --before <approved-workspace> --after <revised-workspace> --output <revision-impact.json>`. `REAPPROVAL_REQUIRED` is a hard review obligation for impacted surfaces. `UNCHANGED_BY_SNAPSHOT` is never proof of existing approval. Do not treat this helper as a replacement for current phase state strict validator, source review lock or runner QA.
