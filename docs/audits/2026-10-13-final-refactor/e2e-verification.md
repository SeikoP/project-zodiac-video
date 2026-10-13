# Native and downstream E2E verification — separate gates

- **Producer/renderer source CI:** SUCCESS at merged Phase 1–3 commits (Actions 38435068533, 38436864893, 38437056778), with newer Phase 2 accent changes awaiting CI.
- **Legacy schema and Job@5 import unit coverage:** tested in Python suite. Successful unit imports are not a fresh end-to-end application import.
- **Candidate slim ZIP:** CI build and CRC validated on Actions 38437254794. Later import scan/repeated build CI tracked separately.
- **Spatial-frame Libra and cafe fixtures:** code-level renderer tests exist. Not independently an MP4/frame-pixel parity PASS.
- **PACKAGE → VOICE → TIMING → PLAN → RENDER → AUDIO → OUTPUT:** NOT_RUN on the local TTS/runtime stack.
- **GUI desktop, speech alignment, voice tail, audio mix, cover and final MP4 decoding:** NOT_RUN, no instrumented media evidence available.
- **Paired performance benchmark:** NOT_MEASURED.

Blocking rule: do not mark Production PASS from a candidate ZIP, spatial report, or source-only CI.
