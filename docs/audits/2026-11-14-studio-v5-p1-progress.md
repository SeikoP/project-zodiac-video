# Studio V5 experiment: spec-to-evidence progress

2026-11-14. Branch `experiment/studio-v5-p1-20261114`, HEAD `d4f2b5be` plus existing local work and this continuation. This report describes the working tree; it does not claim a new commit, CI pass, release or human approval.

**2026-11-15 update:** the local SDK blocker was resolved and native Windows checks/smoke were completed. See [Windows acceptance evidence](./2026-11-15-studio-v5-p1-windows-acceptance.md). The blocked/untested statements below are the historical 2026-11-14 snapshot.

Authority: [roadmap](../superpowers/plans/2026-11-14-unified-zodiac-studio-roadmap.md), [design](../superpowers/specs/2026-11-14-agent-native-creative-studio-design.md), [platform ADR](../superpowers/specs/2026-11-14-studio-platform-choice-adr.md).

| Requirement | Current implementation and evidence | Remaining gate |
| --- | --- | --- |
| P0 foundation | Inherited source-bound importer, registry, events and evidence projection. Current Project Core regression suite: 48 tests PASS. Historical real-source/legacy evidence remains in `docs/evidence/studio-p0-*.json`. | No new creative approval inferred. |
| P1.1 one-window shell | Tauri/React host; opt-in `zodiac --v5-preview`; existing Qt default preserved. HyperFrames Studio/SDK pinned at 0.9.45; read-only workspace imports the real package UI, but is only a skeleton. App package, Tauri commands, CI and README now use pnpm 11.24.0 and one pnpm lockfile. Integrated 44px draggable titlebar contains view/project/connection context and native minimize/maximize/close commands. | Native Windows launch, drag/double-click/buttons, keyboard/focus and restart must be observed. Skeleton is not a working scene editor. |
| P1.2 project transport | Strict method/parameter allowlist, source-bound import/read/status, revisioned metadata writes, recent events and cursor replay, actual V4 catalog. Python stdio import/note/reopen integration passes. | Native reconnect/error behavior remains unobserved. No successful build/compile handlers invented. |
| P1.3 managed agent | Real Codex App Server initialize/thread/turn path; isolated temporary home, read-only task capsule, streamed/final messages, cancellation/retry receipts and explicit confirmation before canonical `project.note`. Actual App Server smoke completed in 12.09s using synthetic source; revision stayed 0 until test-only confirmation, then became 1; all evidence statuses stayed unchanged; managed processes returned to 0. | Real user interaction in native window and unavailable-login/native shutdown cases need desktop verification. This test did not grant human creative approval. |
| P1 resource gate | Vite frontend ready in 880ms; `/`, `App.tsx` and `HyperframesWorkspace.tsx` served HTTP 200. | This is dev-server readiness, not first-visible-window time. Native/Qt startup and idle RAM remain unmeasured. |
| P2 Voice Lab | No completed P2 implementation on this branch. Existing legacy voice code is not the new Voice Lab. | Real synthesis, playback, immutable take selection, human listening and measured timing. |
| P3-P7 | No completed phase deliverables on this branch. Existing V4/Remotion backend remains available. | Compiler VNext, canonical editor round-trip, vetted V5 assets/palettes, audio provenance, full MP4/parity and export gates. |

## Continuation changes

- Fixed Windows agent process ownership: resolve native `codex.exe` rather than npm's cmd/node wrapper, so cancellation owns the actual server PID.
- Fixed missed final output when App Server supplies `item/completed` without text deltas. Out-of-scope server interaction requests receive explicit rejection.
- Rejected applying an old inspection against a newer project revision; idempotent replay of an already applied note remains supported.
- Added managed worker cancellation/join and pipe cleanup. Rust closes stdin to let Python clean up before a bounded forced shutdown; managed Python starts without a console window.
- Migrated only `apps/zodiac-studio` to pnpm. Imported the prior lock, verified ten release-age exceptions against exact existing npm versions, then removed the app's npm lock. Only esbuild's required install script is enabled; default release-age/supply-chain checks remain for future versions.
- Reused the existing topbar as the custom titlebar, with explicit Tauri window capabilities, accessible button names, ellipsis for long project names and interactive controls outside the drag region.

Scope: Python agent/service/stdio, their tests, React app/backend/workspace/styles, Tauri host/config/capabilities, app lock/config, Windows CI and app docs. Main checkout's two tracked edits and `reviews/` were preserved. No source handoff, approved narration, Job@5, media output, production renderer or plugin install was changed.

## Verification

From the worktree root:

```powershell
python -m unittest discover -s tests -p 'test_studio_p1_*.py' -q
python -m unittest discover -s tests -p 'test_studio_project_*.py' -q
```

Results: **27 P1 + 48 Project Core tests PASS**. Four new agent regressions were observed failing before their fixes, then passed: native Windows binary selection, final-item output, stale inspection revision and managed worker shutdown.

From `apps/zodiac-studio`:

```powershell
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm dev
```

Frozen installation and TypeScript pass. pnpm verifies 254 lock entries; Vite serves the real frontend/modules. Rust formatting and `git diff --check` pass.

**Native gate BLOCKED by local toolchain.** Dev startup first failed because `link.exe` was outside PATH. Retrying native checking under `VsDevCmd.bat -arch=x64 -host_arch=x64` located the installed MSVC linker but failed on `kernel32.lib` (LNK1181). Thus Rust typechecking has not completed, and custom titlebar/process-lifecycle behavior has not been validated in a native window. No successful native artifact or current CI result is claimed.

## Handoff and rollback

P1 remains **IN_PROGRESS**, not `MERGE_READY`. Next required work is to supply the Windows SDK libraries, run native dev/check/tests, then verify real import/restart/reconnection, agent cancellation/confirmation/shutdown, titlebar controls and startup/idle RAM against Qt. Keep P2 gated until those observations are recorded.

The experiment remains isolated in its existing worktree with local uncommitted changes. Default `zodiac` still enters Qt; omit `--v5-preview` for rollback. No new release/build/package, merge, push or plugin publication was performed.
