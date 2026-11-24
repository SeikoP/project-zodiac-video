# R0.1 — CI failure diagnosis and repair

Date: 2026-11-24. Branch: `experiment/main-2`. Baseline: `6f4dbe2b147d7e71c8fbe9c8b771be6c766bd48f`.

R0 remains IN PROGRESS. This receipt covers the first CI repair task, not native baseline completion or Graph acceptance.

## Observed remote failure

The exact HEAD push [run 45241235844](https://github.com/SeikoP/project-zodiac-video/actions/runs/45241235844), job `137926124275`, failed in Python P0/P1 contracts and integration. P0 passed 48 tests. The first failure was `IdeasTests.test_existing_registry_projects_survive_additive_schema`: its expected workspace retained Windows `RUNNER~1`, while the registry correctly returned the resolved `runneradmin` path. Later build, browser and Rust checks did not run. The last ten relevant push runs were failures; empty PR-only connector results would not establish green CI.

The GitHub connector provided actual job summaries and logs. Its run-list wrapper only supports PR-triggered runs, so the push runs/check-runs were retrieved through authenticated GitHub REST using the existing Git credential helper, without logging credentials. `gh` is absent locally.

## Scoped repair

- Normalize the existing Ideas fixture root before constructing its expected ProjectHandle, matching the registry test convention. No registry or approval behavior changed.
- Propagate P2 discovery failure immediately, before another Python command overwrites `$LASTEXITCODE`.
- Add a regression that executes the workflow's actual PowerShell body with P2 returning 23; it verifies later suites never execute. Observed RED: workflow returned 0 and ran subsequent suites. Observed GREEN: exits 23 immediately.
- Register timeline, workbench fixture and compact-layout paths. Provision pinned Playwright 1.65.1/Chromium and run both existing browser fixtures against Vite in the app directory, with bounded readiness and process cleanup. Graph tests will be registered when introduced.

## Current local verification

| Command | Actual result |
| --- | --- |
| `python -m unittest tests.test_studio_ci tests.test_studio_ideas -q` | 7 PASS, 1.445s |
| `python -m unittest discover -s tests -p 'test_studio_*.py' -q` | 345 PASS, 343.649s; legacy Qt teardown emits `QNetworkAccessManager already deleted` tracebacks and an `invalidateFilter` deprecation; launcher absence message belongs to its expected failure test |
| `node --test tests/studio_ideas_prompt.test.mjs tests/studio_p34_visual.test.mjs tests/studio_episode_timeline.test.mjs tests/studio_visual_migration.test.mjs tests/studio_p5_assets.test.mjs tests/studio_hyperframes_export.test.mjs` | 42 PASS, 16.274s |
| `pnpm.cmd -C apps/zodiac-studio build` | PASS; existing >500kB chunk warning, entry 267.95kB, deferred tools 34.49kB, preview SDK 1055.12kB |
| `node tests/studio_workbench_browser.mjs` | PASS at 1366×768, 1060×650, 1093×614 |
| `node tests/studio_compact_layout.mjs` | PASS six views, inspector/voice/source/log tabs, pagination at the same three sizes |

Browser setup: `PLAYWRIGHT_MODULE=<repo>/.runtime/workbench-tools/node_modules/playwright/index.mjs`; install using `node .runtime/workbench-tools/node_modules/playwright/cli.js install chromium`; set `STUDIO_BROWSER` to `chromium.executablePath()` from that module. The first launch found no installed Chromium; provisioning completed and both fixture checks then passed. These fixtures do not prove native app performance or human approval.

Independent read-only review found no Critical/Important issue. Deferred minor: readiness accepts any HTTP responder on port 1420; checking the launched Vite process would diagnose a rare port collision sooner. Ruling: unchanged P0-before-pnpm ordering and unrelated path filters remain outside this bounded repair; current remote execution must expose any downstream failure rather than treating this local pass as full CI success.

Remote result after push: PENDING. Native cold startup, resource measurements, uninterrupted fresh agent, R1–R6 and human listening/visual/final-video gates remain open. No release or production merge performed.
