# Independent implementation review: Zodiac Studio V5 / PR #221

Review date: 2026-11-14. Documentation baseline: `217cebe2471e24c6dab023b4cf5365ad5286fd1b` (PR #221). Branch: `experiment/studio-v5-p0-20261114`.

## Verdict: proceed incrementally, do not merge/refactor everything

The design addresses actual seams in the current V4/Web/Local split. **The new Studio is not production ready** and none of the P1–P7 contracts may be considered implemented. Retain old Job@5, source/voice/timing caches and the pinned Remotion path. This branch is for evidence-first P0 tasks, not a wholesale V5 renderer migration.

| Area | Assessment / required correction | Gate |
| --- | --- | --- |
| Web Phase 1 → Studio | Correct to preserve approved source bytes, Web receipt and exact UTF-8 narration offsets. Missing/changed approval must BLOCK, not silently fall back. | P0.3 real v2 ZIP + corrupt/drift tests |
| Project/index ownership | Correct to use SQLite only as an **index**, not a second authoring source. One explicit event/command API and revision checks. Avoid turning metadata actions into creative approvals. | P0.2 implementation + P0.4 receipts |
| Source-bound status | Critical: a valid WAV/legacy restored take is **not** evidence the user listened. Valid ZIP is not exported MP4; exported MP4 is not published. | P0.4 evidence projection |
| Compilation DAG | Keep existing selective graph, scene worker and preview cache. A new whole-episode build must validate *all authored scenes*, shared asset hashes and transactional outputs. | P3 multi-scene fixture + rollback |
| Agent selecting assets | Strong decision: semantic beat requirements → derived capability maps → hard role/contact constraints → bounded candidates → story-aware ranking → real previews. **No graph database or embedding index as a precondition.** | P3/P4 no-fit, diversity and correction tests |
| Physical variants | Source shows five V4 phones sharing **one body contour**. V5 must distinguish actual silhouette, state, case, view and continuity owner, preserving original V4 output bytes. | P3 compatibility; P5 three reviewed master geometries |
| SVG and palette | SVG is appropriate for small vector characters/props but not a replacement for voice, music or licensed media. V4 has 6 fixed-swatch dramatic palettes and 6 backgrounds, not a validated 6-style design system. | P5 real light/dark 1080×1920 contrast, caption/skin/hair tests |
| HyperFrames | Embedding its editor is a reversible frontend choice, **not** proof its renderer meets Remotion parity. Pin actual API/version and test memory and UI event round-trip before replacing Qt/Remotion. | P1 startup/agent spike; P4 parity; P7 encoder benchmark |
| Voice-first order | Correct product move. Requested NORMAL/SHARP metadata must not be reported as actually heard prosody. TTS audio, human listening, measured ASR and scene anchors are separate proofs. | P2 actual listening/timing |
| Music/SFX | Useful if sparse and beat-bound. Mixkit rows are metadata, not playable licensed files; no default sample redistribution or arbitrary SFX quota. | P6 license/file proof; P7 audio-only rebuild |
| Version policy | Do **not** bump every @1 schema. Define adapters only for real semantic changes; keep Job@5 and approved narration SHA immutable. | Every contract change regression |
| Performance | Current historical native-step totals omit agent edits/repair, human review and full render. Never call that E2E wall time; measured cold/warm/one-scene/whole-episode on Windows required. | P0/P3 benchmark manifest |

## Specific review risks

1. **P0.3 importer is the highest integrity risk.** Use existing Node inspection/materialization, validate approval-source hashes before registry mutation, stage files inside trusted root, guard symlink/path traversal, deduplicate concurrent imports and recover rename-before-register crashes. A synthetic test receipt is not release evidence.
2. **P1 scope creep:** a whole desktop frontend, HyperFrames integration and Codex server can easily crowd out useful audio/visual QA. Limit P1 to one working window + project protocol and one safe agent command; no fake editor success.
3. **P3 performance mistakes:** cache already exists. A cache rewrite without profiling can increase startup/IO and corrupt preview/MP4 consistency. Dependency-closure and scoped edit tests precede optimization claims.
4. **P4/P5 visual acceptance:** geometric compatibility and "valid SVG" do not prove compelling narrative frames, physically plausible hand-object contacts or real palette diversity. Keep human Visual Review as a distinct gate.
5. **P6/P7 licensing and audio correctness:** require file hash, source/usage rights, cue timing and listening QC, including explicit silence/voice-only option.
6. **Production separation:** never patch old approved narration, move/delete existing ZIP/MP4, or silently sync ChatGPT plugins from this experiment.

## Evidence and implementation state

- P0.1 baseline fixture/audit: implemented; 8/8 source assertions, 11/11 Studio V2 ZIP tests and 9/9 Studio V2 voice tests pass on Windows Python 3.11.9.
- P0.2 durable SQLite registry: implemented; 9/9 registry tests, 8/8 Studio V2 session tests and 7/7 Studio V2 state tests pass. Windows SQLite file-handle cleanup regression was found and fixed before commit.
- P0.3 import a real approved v2 capsule: **PENDING**; no claim of import E2E.
- P0.4 status and phase evidence gate: **PENDING**; no real human approval claimed.
- P1–P7: **NOT STARTED**. Neither new phone master SVG, V5 palette, executable HyperFrames editor nor audio library has been built.

**Next safe task:** P0.3 with strict negative cases and existing native importer reuse. If the approved capsule is missing, block the real E2E milestone rather than generating a fictional approval. Close P0 only after P0.4 and compatibility tests; open a focused implementation PR as a draft before requesting merge.
