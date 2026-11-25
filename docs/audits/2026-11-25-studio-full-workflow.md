# Studio full workflow improvement — 2026-11-25

## Scope and decisions

Reviewed the current main-2 import/content → voice/assembly/listening → timing → visual authoring/checks/repair → assets/cover/publish → scenes/build → Visual Review → export path. The existing pipeline/scene/agent-part work was local and uncommitted; this handoff includes its source and test dependencies so remote collaborators can run the same workflow. Other audit drafts, creative specs and generated media remain outside the commit.

Retained the existing production step list, canonical revisioned writers, user approval gates and system font. Removed the unreferenced @xyflow/react package addition: no source imports it. No new package dependency is introduced by this handoff.

## Improvements

- Equal in-flight read RPCs share one request across panels. Completed/failed reads release the slot. Writes and different projects remain separate. This reduces duplicate work without caching stale state.
- Old failed polls cannot overwrite a newer successful read; disposed workflow stores ignore late replies.
- Repeated start preserves the active run and its retry budget. A genuinely new run gets a fresh ID so canonical command IDs cannot collide across retries/restarts.
- Stop is serialized against ordinary dispatch and proposal application. Cancellation is checked again before starting the real agent. Agent timeout cancels the owned task.
- Switching to confirm mode pauses before the next automatic step; confirming a gate cannot silently resume automation in confirm mode.
- Successful whole-episode voice confirmation resumes only an autopilot waiting at voice_review. Unit confirmation grants no episode gate.
- First workflow read after reopening recovers persisted RUNNING to IDLE; no phantom running process or invented completion.
- Invalid/missing selected voice takes are regenerated individually; healthy units survive repair.
- Visual revision is captured before authoring. An intervening visual edit blocks stale output. Voice/timing fingerprint travels from the original authoring capsule into the canonical visual command's existing voice-state lock, matching manual agent application.
- Browser checks now interact with folded completed phases and dedicated voice/export stages. Host minimum-width test matches the current 800 px responsive GUI.

## Evidence

- Pipeline baseline before changes: 158 Python tests passed.
- Broad Studio regression excluding VoiceLab: 521 passed, 98 subtests passed, 9 existing Qt deprecation warnings, 278.59 seconds. Command: enumerate tests/test_studio*.py except test_studio_p2_voice_lab.py, plus tests/test_voice_worker_batch.py; run pytest -q -x. Latest guard changes are checked separately below.
- VoiceLab: 21 passed, 6 subtests passed, 28.99 seconds.
- JavaScript/TypeScript behavior tests: 33 passed (RPC sharing, pipeline store, Ideas prompt, acting).
- Frontend TypeScript/Vite build: PASS. Existing SDK >500 kB warning and transitive browser os externalization warning remain. These are bundle observations, not measured native startup gains.
- Browser fixture workflow: PASS for mode/autopilot, stale rerun, user gates, inspector routing and four viewport sizes (1366x768, 1060x650, 1093x614, 800x960).
- Browser VoiceLab: PASS for complete list, adaptive layouts down to embedded 280x260, selection, listening gate and audio pause on leaving.
- Focused post-review checks (proposals, autopilot, runner, RPC, agent authoring): 116 passed, 2 subtests passed, 33.08 seconds. Final autopilot/proposals rerun after the last call-site simplification: 65 passed in 1.19 seconds.
- Independent read-only review identified stop/restart/source-dependency races; repaired and regression checked.

Browser checks use .runtime/workbench-tools/node_modules/playwright/index.mjs and locally installed Chromium 1255, against the existing dev server on 1420. Test fixtures use temporary synthetic content/listening evidence; they grant no approval to a real episode. Full generated test logs remain in the OS temp directory, not in Git.

## Acceptance still pending

Native Tauri execution/build remains unverified because the local Windows SDK libraries are missing (earlier link failure: kernel32.lib). No installer, release, production merge or publication was attempted. A real provider → actual audio → final MP4 run and user listening/visual/video approval remain pending. Cover/publish are source-bound drafts; structural frame inspection does not claim human visual judgment.
