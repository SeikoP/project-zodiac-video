# P1 Windows dev acceptance — 2026-11-15

Branch: `experiment/studio-v5-p1-20261114`, committed HEAD `d4f2b5be` plus local uncommitted implementation. **P1: TESTED, pending review/integration.** This is a native dev smoke, not a release, human creative approval, P2 Voice Lab or P4 scene editor.

## Remote integration audit

Fetched `origin` and checked live GitHub PR metadata and Git ancestry:

| PR | GitHub state / target | Code relationship |
| --- | --- | --- |
| #221 | Open Draft → `main` | Spec already integrated into `experiment/main-2` by merge `16fb1da1`; inherited by P1. |
| #222 | Open Draft → spec branch | P0 already integrated into `experiment/main-2` by merge `2454204a` and subsequent P0 commits through `6ea526ae`; inherited by P1. |
| #223 | Open Draft → `experiment/main-2` | Four P1 commits through `d4f2b5be` remain absent from `main-2`; this is the current working branch. |

Local/remote P1 committed heads match (0 ahead / 0 behind); all pnpm/titlebar/agent continuation changes remain local. The three PRs were **not merged, retargeted or closed**. Saying their code is inherited by P1 is not saying GitHub has merged them. Production `main` and its existing dirty files remain untouched.

## Toolchain repair

- Obtained Microsoft's version-pinned Windows SDK NuGet packages under ignored `.runtime/windows-sdk/10.0.28000.2957`. The C++ and x64 packages supply headers, resource tools, Win32 and UCRT libraries; no administrator installation or machine-wide environment changes.
- Verified the resource compiler's Authenticode signer is Microsoft Corporation with valid status.
- Restored 422 missing Rust `windows-0.62.2` cache files from the existing `.crate` archive after its SHA-256 matched `Cargo.lock`. No dependency version/source patch was introduced.
- Local `.runtime/studio_native.py` scopes the installed MSVC linker, SDK paths and backend Python interpreter to native development commands.

## Automated checks

From the worktree root:

```powershell
python -m unittest discover -s tests -p 'test_studio_p1_*.py' -q
python -m unittest discover -s tests -p 'test_studio_project_*.py' -q
python .runtime/studio_native.py cargo check --locked --manifest-path src-tauri/Cargo.toml
python .runtime/studio_native.py cargo test --locked --manifest-path src-tauri/Cargo.toml
```

Results: **29 P1 + 48 Project Core Python tests PASS; 1 Rust test PASS; native cargo check PASS.** Frozen pnpm install, TypeScript, Rust formatting and diff checks also pass. No current remote CI pass is inferred from local tests.

Native restart testing found another defect: receipt UUID sorting could restore an older cancelled task ahead of a newer completed/applied task, including dropping the newest task at the receipt limit. Fixed recovery to sort by start time before limiting, preserve sub-second start precision, and ignore malformed ordering/status fields. New ordering/limit and malformed-receipt regressions were observed failing before their fixes, then passed. Restarting the actual native backend restored the completed/applied note correctly.

## Actual native-window workflow

Tests used an isolated `.runtime/gui-acceptance/projects` registry and the existing explicitly synthetic handoff fixture. Any confirmation below is automated test interaction on that fixture, **not a genuine human Content/Voice/Visual approval**.

| Check | Observed result |
| --- | --- |
| One user-facing Tauri window, backend READY | PASS; frontend `isTauri` true and real stdio RPC health READY. Tauri's tiny internal event-target helper is not a second app UI. |
| Source import/reimport/reopen | PASS; native RPC deduplicates project identity, revision survives restart, initial Voice remains UNKNOWN. |
| Revisioned note + forbidden method | PASS; `project.note` advances revision; `shell.exec` rejected; evidence statuses unchanged. |
| Custom titlebar | PASS; native maximize/restore/minimize buttons and actual mouse dragging observed, then window restored. |
| Agent cancel | PASS through the native React control; revision unchanged. |
| Agent retry/stream/final/confirmation | PASS; real Codex inspection finished, test flow including confirmation took 14.79s. No metadata write before confirmation; afterward exactly one note revision and unchanged evidence statuses. |
| Backend reconnection | PASS; intentionally stopped only this test window's Python sidecar; next RPC restarted it and preserved revision. |
| Agent receipt recovery | PASS after ordering fix; newest completed task and `write_applied` restored correctly. |
| Close while agent active | PASS through the titlebar close button. All 11 captured app/WebView/Python/Codex/conhost processes exited within four seconds; no captured descendants remained. |
| Codex absent | PASS; temporary invalid Codex executable gave `AGENT_UNAVAILABLE`, backend stayed READY, and manual notes still worked. |

Window screenshots and metric data are local under `.runtime/gui-acceptance/`. After acceptance, closed the test windows and opened the normal preview project store without test data or the CDP debugging listener. The visible final overview reports Project Core connected and an empty project list; synthetic test receipts remain isolated.

## Resource measurements

One sample each on this Windows machine; Vite/model processes excluded. Native is the warm debug executable with CDP enabled; Qt is its existing frontend on an isolated empty workspace. These are different UI/runtime scopes, not a production speedup benchmark or p50/p95 result. Working-set sums may double-count shared pages.

| Measurement | Native dev | Qt baseline |
| --- | ---: | ---: |
| First visible window | 0.074 s | 5.918 s |
| Native React UI + Project Core connected | 1.969 s | Not measured separately |
| Process-tree working set after short idle | 469.96 MB | 118.25 MB |
| Process-tree private bytes | 240.93 MB | 67.44 MB |

The native dev host uses materially more idle memory than Qt. No memory-efficiency or final release-performance acceptance is claimed.

## Running state and remaining scope

The native dev app was left open on the normal preview store. Machine-local `.runtime/Zodiac Studio V5.lnk` uses a windowless launcher; `.runtime/start-studio.py` starts/reuses the dev frontend and opens the existing debug executable. SDK/setup helpers and binary remain ignored local development artifacts.

No merge, push, package, release, plugin install, new creative approval or production media mutation. P2 Voice Lab and later phases remain separate; this continuation does not implement them. Review/experimental branch integration and real user acceptance remain to be recorded before declaring `MERGE_READY`.
