# Runner integration requirements (not automatically deployed)

Target repo `SeikoP/project-zodiac-video` / local zodiac-renderer@2.0.1. This plugin cannot change the external runner by packaging authoring docs.

- Check `zodiac-job@5` schema; reject unsupported motion presets and unresolved asset refs prior to render.
- Preview and final video must render the exact same ordinary environment/prop/effect entities from the job; prohibit silent filtering and preview-only fallbacks.
- All supplied SVG assets must be visible when scheduled (with explicit show/hide events); do not disable prop/effect motion during optimization.
- Validate frame snapshots at beginning/middle/end and at each semantic event: asset ids, transforms, layering, and captions.
- Character transitions use complete SVG state_swap (no fake limb rig); default state budget is advisory, with justified overrides.
- Benchmark CPU motion budgets separately, preserve deterministic timings and no visual jitter from randomization.

Release acceptance requires independent runner commit/tests. **Plugin update does not mean runtime was deployed.**
