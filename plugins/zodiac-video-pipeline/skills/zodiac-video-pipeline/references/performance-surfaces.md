# Performance Surfaces Contract

A Zodiac episode is reviewed on three different surfaces. A PASS on one surface never implies PASS on another.

1. **Silent Read** — narration as text only. No TTS, music, captions, motion, editing or visual rescue.
2. **Spoken / TTS** — the exact approved narration as synthesized and aligned audio. Review pronunciation, breath, pace, emphasis, internal-voice distinction, joke landing and ending cadence against the authored Spoken Performance Plan.
3. **Rendered Video** — the final mixed MP4. Review whether captions, cuts, visuals, music and motion preserve rather than pre-empt or flatten the spoken effect.

Lineage is strict:

`narration.txt -> silent-read-review.json`

`narration.txt + voice-profile.json -> spoken-performance-plan.json -> tts-text-preflight.json -> voice.wav + timing.json -> tts-performance-review.json`

`tts-performance-review.json + timing.json + final MP4 -> rendered-performance-review.json -> media-acceptance.json`

Deterministic validators prove source identity, grounding and complete review decisions. They never infer that a joke landed or that a performance sounded natural. Those remain actual review judgments.

Content Review approves content/narration. It does not certify synthesized prosody or final audiovisual effect. Visual Review approves authored visual intent/assets. It does not certify final MP4 timing. Local runner acceptance must therefore remain blocked until TTS Performance Review and Rendered Performance Review both PASS on exact final bytes.
