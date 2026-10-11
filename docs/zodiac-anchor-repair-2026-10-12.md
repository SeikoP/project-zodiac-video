# Leo anchor scheduling repair — 2026-10-12

The revision 1.0 Leo export contained two deterministic same-target, same-anchor conflicts: S05 friend expression/gaze and S06 Leo expression/shared reaction. A 10-frame motion exceeded the second event's 8-frame drift allowance. Native archive/import checks alone did not exercise timeline scheduling.

Revision 1.1 anchors friend gaze to the spoken compliment and Leo's shared reaction to “Có gì đâu, vui là chính mà.” Narration bytes, native asset bytes and entity geometry remain unchanged. Static producer compilation now checks same-anchor lanes, preserving explicit adequate drift, independent actors and semantically permitted merges. This is not a measured timing certification.

The runner persists RUNNING for uncached PLAN and following stages while retaining DONE cache candidates. Qt refreshes the failed stage before opening its modal error dialog.

Validation: orchestration 531/531; Python executor/timeline 24 tests + 3 subtests; final release/anchor checks 12/12. Actual revision 1.1 native Phase2 finalization, Director, Phase3 export/import/roundtrip/semantic and Python ZIP import PASS. Synthetic word-timing replay reproduces both old 10/8 conflicts and schedules all 7 scenes/11 events after repair. Measured timing/TTS/MP4 for this episode remains unverified.

Repaired ZIP SHA256: 932311c2555866c1bb5d8a9d78abd539109840dbd782d30aecc52e2d9e944e02. User repair authorization is recorded separately from a new aesthetic or audio review.
