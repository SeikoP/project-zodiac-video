# Story text in Phase2

Consider lettering alongside action, props and Narrative Visuals. Its job can be setup, contrast, payoff, annotation, dialogue or internal voice; it does not depend on selecting a meme. Use short channel-style phrases that add meaning, rather than duplicating continuous captions. Record `story_text=use/omit` with a reason in per-beat visual coverage; do not force text into every beat.

Author an ordinary `kind: object`, `visual_role: overlay` entity, backed by `category: overlay` SVG assets. Keep its `story_text: {purpose, reason, states: {state_id: text}}` in Visual Intent only. The native compiler strips this authoring metadata; Job5/runtime use the existing overlay role, assets and state events. Text never counts as a physical prop, Scene Accent or the required Narrative Visual.

Start hidden. Reveal/change lettering with exact voice anchors; release it when its story job ends. A final label may remain through scene end with `hold_to_scene_end_reason`. Keep one text focus at a time, clear of faces and the lower caption zone. Never reveal a punchline before its spoken turn. Use different states to contradict or replace a setup, rather than accumulating words.

Use outlined Patrick Hand paths, canonical ink/coral and accessible SVG titles. In this repository `python tools/preview/bake-story-text.py <workspace> --intent <candidate.json>` bakes authored state strings to their declared asset paths before `write-phase02-authoring.mjs`. It needs authoring-time fontTools; runtime needs no font/parser dependency. Otherwise supply equivalent native path SVGs and verify exact lettering visually.

Authoring completeness enforces purpose, overlay role, hidden setup, reachable anchored reveals and release/end hold. Visual coverage declares `story_text` separately. Run native style, geometry, caption safety and all event-pair checks, then inspect phone-size readability. Endpoint PASS never proves audio-aligned timing or final rendered font/lettering appearance.
