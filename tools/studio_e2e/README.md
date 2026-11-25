# Studio GUI e2e (real window, real clicks)

Drives the running Tauri window through Chrome DevTools Protocol, the way a person would.

1. Start the app with debugging on and an isolated store:
   `pwsh apps/zodiac-studio/scripts/launch-preview.ps1 -Executable <exe> -ProjectsRoot <dir> -CdpPort 9227`
   (the Vite dev server must be running for a debug build).
2. In a script: `const page = await connect(); await page.click("return document.querySelector('...')"); await runStep(page, 'Giọng đọc')`.
3. `page.shot(path)` saves a screenshot; keep screenshots under `.runtime/` (ignored).

Never click human approval controls (listening, visual review, export) from automation.
Tests: `node --test tests/studio_e2e_cdp.test.mjs`.
