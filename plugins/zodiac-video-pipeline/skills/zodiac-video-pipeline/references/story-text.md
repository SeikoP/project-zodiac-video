# Story Text in Phase 2

Story Text is short authored lettering used when a few readable words explain the scene's key point better than a Narrative Visual.

A scene may contain **Story Text or Narrative Visual, never both**. This is a focal-semantic-layer rule, not a density quota: a scene may use neither.

Choose Story Text for a short reply, thought, verdict, label, score, product reveal, annotation, or punchline where the words themselves are the clearest content. Choose Narrative Visual only when a concrete visible action/state communicates the point better than text.

Author `kind: object`, `visual_role: overlay`, `category: overlay` SVGs with `story_text: {purpose, reason, states, styles}` in Visual Intent. Purposes: setup, contrast, payoff, annotation, dialogue, internal_voice.

Start hidden. Reveal/change/release at exact voice anchors; a final hold needs `hold_to_scene_end_reason`. Replace text rather than accumulating it. Never reveal a punchline early. Keep one focal Story Text entity at a time.

Supported treatments: `bubble`, `thought`, `burst`, `whisper`, `tag`, `ribbon`, `underline`, `sfx`, `note`, `stamp`, `score`, `title`. Choose by meaning, not rotation. Compact styles normally use 1–4 words; shorten rather than shrink long prose.

Story Text may coexist with actors, physical props, Scene Accent, effects, and runtime captions. It may not coexist with Narrative Visual in the same scene.

Bake safe path SVG lettering before projection, then run completeness, style/geometry/caption, event-pair, phone-size preview, and human Visual Review. Structural PASS never approves creative quality or final timing.
