# Job@5 E2E acceptance gate (P0)

This is a **separate acceptance receipt**, not proof supplied by ZIP validity, payload parity, unit tests, or CI. It deliberately does **not** assert that a visual is correct without explicit event-frame review.

## Canonical evidence

- Baseline runner commit: `5a496b042ad5da40e8710116459ba67c61783728` (#67).
- Baseline plugin source: `e662fa2b0d564dce54b457d2165df7dd2f7d5cb1` (plugin 2.1.6).
- Fixture: *Bọ Cạp — Hai phiên bản*, 12 scenes, spatial bindings. The ZIP and rendered MP4 have **not** been run/reviewed in this audit.
- Render path: `production.ir.json → render-plan.json → renderer props → actual frames`.

## Feature parity — evidence status, do not equate installed code with PASS

| Capability | Legacy | Job@5 / Renderer 2 | Status | Next evidence |
| --- | --- | --- | --- | --- |
| Legacy Job@2–4 | `tools/zodiac_local.py` | separate Job@5 flow | UNVERIFIED | smoke legacy ZIP |
| Asset/state/event preservation | semantic production | payload parity in #65 | CODE_FIXED_NOT_VISUALLY_VERIFIED | inspect timed output frames |
| Prop/effect visibility | semantic animation | #62 visibility reveal | CODE_FIXED_NOT_VISUALLY_VERIFIED | inspect appearance + duration |
| Spatial subject/recipient roles | older contract | plugin #13, runner #62 | CODE_FIXED_NOT_VISUALLY_VERIFIED | verify action direction |
| Preview/render | legacy Studio | Remotion still preview #62 | UNVERIFIED | match actual video frames |
| Scene audio gap | legacy separate defaults | #67 WAV/timing gap source | CODE_FIXED_NOT_VISUALLY_VERIFIED | compare spoken WAV + captions |
| Intra-sentence pause | legacy timing defaults | not evidenced | UNVERIFIED | waveform + word timestamps |
| SFX/transitions | `generate-sfx.mjs`, semantic modules | renderer 2 implementation | UNVERIFIED | source diff + audible/render checks |
| Cover/publish | legacy output | #66 output export | CODE_FIXED_NOT_VISUALLY_VERIFIED | files + TikTok crop review |
| GUI/cache/resume | legacy paths | Studio Job@5 | UNVERIFIED | desktop E2E |

## Receipt gate

Run `python tools/audit_job5_e2e.py /path/to/e2e-receipt.json --expected-scenes 12`. The receipt must contain:

```json
{
  "contract": "zodiac-job@5",
  "scenes": [
    {
      "id": "S01",
      "reviewed_frames": [0.1, 1.0, 2.0],
      "asset_visible": true,
      "state_correct": true,
      "event_timing_correct": true,
      "spatial_semantics_correct": true,
      "effect_visible": true,
      "caption_safe": true,
      "font_correct": true,
      "transition_correct": true
    }
  ],
  "artifacts": {
    "video": "out/zodiac-story.mp4",
    "cover": "out/cover.png",
    "publish_json": "out/publish.json",
    "publish_copy": "out/publish-copy.txt"
  },
  "voice_caption_synced": true,
  "ending_not_cut": true,
  "gui_responsive": true,
  "logs_unobstructed": true
}
```

The sample frame timestamps are placeholders **only**: each scene must use at least three actual timestamps including the key event, effect visibility and payoff. Include **every scene** in the real receipt. Artifact paths resolve relative to the receipt. A reviewer must inspect the actual frames and audio before checking a boolean. The script checks assertions and file existence, **not visual correctness or audio signal properties**. Never treat a manually filled receipt as independent visual proof.

### Release rules

Never declare PRODUCTION_READY if evidence is absent. No automatic merge based on this receipt. CI/unit tests remain separate gates. Next code work: identify concrete Renderer 2 paths, compare old transition/SFX semantics, implement intra-sentence silence in audio with alignment/cache invalidation, then run the Bọ Cạp fixture.
