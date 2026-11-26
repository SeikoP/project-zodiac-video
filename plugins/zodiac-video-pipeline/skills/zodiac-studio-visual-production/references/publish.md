# Cover and publish prep

Publish Prep reuses approved narration and production states. It does not reopen story research. Outputs: `publish/publish.json` and `publish/publish-copy.txt`.

## publish.json
`platform: tiktok`; `cover` with `layout: tilted_top_hook`, `identity {sign_id, label, glyph}` (episode scope: `{episode_id, label, glyph}`), `hook`, `source_scene_id` (a real scene), `visuals [{entity_id, state_id}]` that resolve in that scene; plus `caption`, `title`, `hashtags` (non-empty), `source {narration, production}`. Cover visuals **reuse production states**; no cover-only AI image or state.

## Cover composition
Select what appears, not exact coordinates; the canonical layout places it. One hero or cast grouping and at most 1–3 meaningful supporting props or effects, secondary to identity, hook and faces. Use or omit decisions, each with a reason, for actor, Story Visual, prop, Scene Accent and effect; do not force decoration, omit a participating actor, or drop the symbolic object that makes the conflict intelligible.
- Title: a crooked paper-note frame (card fill, ink stroke, soft shadow), `Patrick Hand`, two to three balanced lines, a complete hook of about 6–14 words when the story earns it; never truncate a contradiction into a slogan. Identity (sign and glyph) is separate from the hook.
- Read order: hook, identity, character with the primary Story Visual. Margins at least 72 px; faces and key detail away from the extreme top and bottom.
- Palette and style are the token's; no gradients, glow or generic UI shapes.

## Cover opening
New videos may open on the cover: `cover.opening {enabled, duration_sec 0.5–3, transition_sec ≤ 0.6}`. It reuses the same cover component for the first frames and dissolves into the first scene; narration, captions and audio start at frame zero and are never delayed. Captions are hidden while the opening shows.

## publish-copy.txt
In order: `COVER IDENTITY:`, `HOOK:`, `TIKTOK CAPTION:`, `HASHTAGS:`, optional `ALT HOOKS:`. Retention checks compare against an exact excerpt of the narration, never a paraphrase.

## Review
Valid JSON is not visual QC. Check the cover at thumbnail width and frame 0 with the dissolve for title, face and caption collisions. Metadata PASS is not pixel quality.
