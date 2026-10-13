# Narrative Visual — Hình ảnh diễn giải

**Fresh authoring:** one taxonomy, `narrative_visual`. Meaning is narrative intent, not SVG shape. Use for thought, comparison, emotional context, metaphor or changing mental state. It is independent from the background, Scene Accent, physical prop and reaction effect.

Supports a single static state or multiple narration-anchored states, independent actor positioning, above-head and near-actor placement, conceptual identity and optional emphasis. A simple static symbol does **not** require setup/friction/payoff. Actor-relative physical grips and `held_by` are not required for a mental image.

At transport the producer emits existing `story_object` category/visual role; the renderer handles it independently from prop density. Legacy Story Object, Story Symbol and Visual Metaphor names are compatibility inputs only. Do not change the Job@5 schema hash to introduce a duplicate fresh category.

Tests: Phase 2 intent projection, Phase 3 compile, Libra balance renderer spatial-frame fixture, negative co-visible density. Creative readability and actual MP4 frame parity remain review gates rather than implied PASS.

Source: `features/visual-composition/compile-visual-intent.mjs`, `phases/phase03/compile-job-v5.mjs`, renderer 2.0.1 visual role/spatial layout.
