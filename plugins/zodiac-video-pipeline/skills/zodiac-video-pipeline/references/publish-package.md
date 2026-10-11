# Publish package contract v1.6

Publish metadata belongs to **Visual Production → Publish Prep**. It reuses approved narration and production states; it does not reopen story research and creates no ZIP.

## Files
- `publish/publish.json`
- `publish/publish-copy.txt`

## `publish.json`

```json
{
  "version": "1.5",
  "platform": "tiktok",
  "cover": {
    "layout": "tilted_top_hook",
    "identity": {"sign_id": "libra", "label": "THIÊN BÌNH", "glyph": "♎"},
    "hook": "Concise hook",
    "source_scene_id": "S04",
    "visuals": [
      {"entity_id": "libra", "state_id": "explain"},
      {"entity_id": "scale", "state_id": "balanced"}
    ]
  },
  "caption": "...",
  "hashtags": ["#ThienBinh"],
  "source": {"narration": "narration.txt", "production": "production.json"}
}
```

Rules:
- `cover.layout` is `tilted_top_hook`;
- identity label/glyph, hook, caption and hashtag list are non-empty;
- `source_scene_id` resolves to a real scene;
- every cover visual resolves to an entity/state in that source scene;
- cover visuals reuse production states; no cover-only AI image or state by default.

## Runtime-owned cover composition
The canonical runtime renders a TikTok-safe 1080×1920 cover with the large identity treatment, hook frame and selected source-scene visuals. Publish Prep normally selects **what** appears, not exact coordinates.

`visuals[].transform` remains supported only as an exceptional override when an approved composition cannot be represented by the canonical layout. Do not manually place every cover prop merely to fill empty space.

Prefer one hero/cast grouping and at most 1–3 meaningful supporting production props/effects when they improve recognition. They remain secondary to identity, hook and faces.

## `publish-copy.txt`
Order:
1. `COVER IDENTITY:`
2. `HOOK:`
3. `TIKTOK CAPTION:`
4. `HASHTAGS:`
5. optional `ALT HOOKS:`

## Local outputs
The renderer produces loose files:

```text
out/
├─ zodiac-story.mp4
├─ cover.png
├─ publish-copy.txt
└─ publish.json
```

Zodiac Studio does **not** create `zodiac-publish-bundle.zip`. The only optional creative archive is `zodiac-job.zip`, owned by explicit Handoff Export.

## Publishing strength addendum v2.3.1
Read `references/publish-virality.md` as editorial authority. For new content, include optional `title` as a sign-specific search/title line and optionally append `TITLE:` in `publish-copy.txt`. Preserve existing `cover.hook` and original four copy markers to keep current runner compatibility. Prefer 4–7 meaningful multi-role hashtags (sign, topic, niche, brand; series when applicable), never pad for count. Do not assert "more tags => more views". Existing packages without title stay compatible.


## Cover Composition v2 (new v2.4.14)
Fresh Publish Prep must read `references/cover-composition-v2.md`, include `cover.design` derived exclusively from V4 style token and scene-native assets, run `node orchestration/validate-cover-design.mjs <workspace>` before Visual Review. Explicitly note the runtime must implement title shadow and scale; producer validation cannot assert final cover.png pixel parity. Do not replace environment with story object. Old approved covers remain compatible via `--allow-legacy` only.
