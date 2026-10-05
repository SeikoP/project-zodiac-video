# Current zodiac-video-pipeline v2 compatibility review

This repository now targets the plugin's current **production contract v2.0** rather than the previous 0.9.1/v1 handoff.

## Matched contract

- `design.md` is required and its marked STYLE_TOKEN hash must match `production.json.visual_system.style_token.source_hash`.
- `production.json.version` must be `2.0`.
- Scenes use `entities + states + events`, not the old `actors/objects/actions/motion` layout.
- Events support `scene_start` and exact `voice_anchor` triggers.
- Runtime captions are measured word-level tokens, enabling active-word caption pages and event resolution.
- Caption contract requires local **Be Vietnam Pro** weight 500.
- The current renderer scaffold includes schema validation, style compilation, runtime event resolution, renderer tests and TypeScript typecheck.
- Local runtime preserves `production.json` as the creative contract; voice/timing/audio settings remain runtime-owned.

## Local voice boundary

The repository keeps VieNeu as its local TTS integration. This does not change the plugin creative contract.

After scene WAV generation, `faster-whisper` supplies measured word timestamps. Alignment is strict: if normalized recognized tokens do not match approved narration, the local run stops instead of fabricating timestamps.

Externally generated voice/timing remains supported through `attach`.

## Audio boundary

Background music is local runtime state, not a creative `production.json` field.

- selected music is copied to `media/`;
- volume is stored in `.runtime/audio.json`;
- **Nghe thử** creates an exact-duration voice/music audition;
- final background music is post-mixed after Remotion renders voice + SFX;
- the canonical renderer source is not patched.

## Preview boundary

The GUI label now describes the operation correctly: it opens **Remotion Studio**, which remains alive until stopped.

On POSIX, Studio is launched in its own session/process group and stop sends SIGTERM to the group with SIGKILL fallback. Windows uses `taskkill /T /F`.

## Remaining verification boundary

Static/unit tests cover the Python package/runtime contract and audio command construction. A real end-to-end acceptance still requires a current v2 plugin package plus real VieNeu output/faster-whisper alignment, npm install, Remotion Studio/render and listening to the exported MP4.

Do not claim a particular video/audio export passed visual or listening QA until that local render has actually been inspected.
