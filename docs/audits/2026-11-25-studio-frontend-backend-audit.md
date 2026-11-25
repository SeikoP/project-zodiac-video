# Studio frontend/backend audit — 2026-11-25

Scope: single-user desktop Studio, React → Tauri serialized stdio → Python Project Core. Current main-2 files inspected directly because CodeGraph indexes the other checkout. Existing pipeline/authoring/UI changes are local work and excluded from this commit.

## Findings and implementation plan

| Priority | Concrete failure | Smallest change | Status |
|---|---|---|---|
| P0 | Python commits a write then exits before replying; host replays the same request, potentially starting work twice | Retry only an explicit list of read operations; unknown operations fail closed | Implemented |
| P1 | A visual.command above 64 KiB is rejected by Rust although Python accepts up to 2 MiB | Match Python's method-specific payload limit | Implemented |
| P1 | stdio readline allocates an arbitrarily long inbound line before rejecting it | Bound reads, drain the rejected frame in fixed chunks, preserve next request | Implemented with subprocess regression |
| P2 | PagedText observer captures old maxLines or misses textarea after changing read/edit mode | Reconnect observer when either input changes | Implemented |
| P2 | Select controls use browser font and omit the shared keyboard focus rule | Include select in existing typography/focus selectors | Implemented |

Callers inspected: backend request/voiceAudio/projects pagination, App loading and refresh, Paged/PagedText consumers (VoiceLab, AssetGallery, App), Python dispatch/stdio loop, Rust request host, pipeline polling store. No dependency or data migration is needed. Approval gates remain user-owned.

## Validation and evidence

- `pnpm --dir apps/zodiac-studio build`: PASS, TypeScript and Vite. Entry JS 267.48 kB; deferred SDK 1,055.12 kB. SDK chunk warning and browser externalization warning for transitive `os` remain. Bundle size is not cold-start timing.
- `node --test tests/studio_pipeline_layout.test.mjs tests/studio_ideas_prompt.test.mjs`: 18 PASS.
- `python -m pytest tests/test_studio_p1_rpc.py tests/test_studio_p34_visual.py tests/test_studio_p1_tauri_host.py -q`: 24 PASS, 15 subtests PASS, 1 FAIL. Failure: host test expects minWidth 1060, current pre-existing dirty tauri.conf.json uses 800. This audit does not change either value.
- Added real subprocess regression: 3 MiB rejected frame followed by health yields exactly two replies and valid correlation for health.
- Native unit test added for safe retry policy. `cargo test --manifest-path apps/zodiac-studio/src-tauri/Cargo.toml --lib audit_tests` blocked: default shell misses link.exe; VS Developer shell finds it but fails LNK1181, missing kernel32.lib. Windows SDK library directory is absent.

## Remaining validation / next work

- Install/repair the Windows SDK, run the native retry test and exercise lost-response behavior in the desktop host. A failed write response means outcome is unknown: refresh state before a manual retry.
- Reconcile the 800/1060 minimum-width contract with the existing GUI refactor, then rerun host/layout tests at the chosen minimum size.
- Profile actual native startup, RPC latency and a real episode before broader performance changes. Existing pipeline polling already pauses on visibility and preserves snapshot identity; no replacement store is justified by this audit.
- Inspect GUI typography and pagination at multiple font scales in the native WebView. Font family is kept as the existing Vietnamese-capable system stack; select font inheritance is fixed.

Not audited exhaustively: rendering/compiler internals, agent provider networking, credentials, full production load, real voice generation, MP4 playback/listening or user creative approval. No release/installer or production merge performed.
