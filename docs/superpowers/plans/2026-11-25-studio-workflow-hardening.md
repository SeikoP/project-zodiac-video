# Studio workflow hardening — 2026-11-25

Scope: import → content evidence → voice generation/assembly → human listening → timing → visual authoring → checks/repair → assets/cover/publish drafts → scene build → human Visual Review → MP4 export. Single-user desktop. No creative approval is inferred from tests.

- [x] Inspect current workflow and run pipeline baseline: 158 tests passed.
- [x] Add failing regressions for duplicate start, stop races, stale authoring, run identity, confirm mode, restart recovery and voice gate continuation.
- [x] Prevent replay/reset of active autopilot; allocate new command identity for a new run.
- [x] Serialize stop against plain dispatch and proposal application; check cancellation before starting the real agent.
- [x] Reject an agent result when visual revision changed during authoring; carry voice/timing fingerprint into the canonical atomic guard.
- [x] Resume after successful episode voice confirmation only at the matching waiting gate; respect confirm mode.
- [x] Recover persisted RUNNING to IDLE on the first workflow read after restart.
- [x] Regenerate only missing/invalid selected voice takes, preserving healthy units.
- [x] Share equal in-flight read RPCs across panels; never cache finished reads or share mutation requests.
- [x] Ignore stale failures and pending responses after store disposal.
- [x] Align workflow browser tests with folded completed phases and dedicated voice/export stages; align host minimum width with current responsive GUI (800 px).
- [x] Finish broad regression checks and record exact evidence in docs/audits/2026-11-25-studio-full-workflow.md.
- [x] Prepare scoped workflow handoff with required source dependencies; commit/push result is reported in the final response.

Ruling: retain the existing production step list and native canonical services. No new editor architecture or dependency is needed. The existing pipeline/scene/agent-part integration was uncommitted at start; include its source dependencies explicitly in this workflow handoff so the remote branch can run it. Preserve unrelated audit/creative/media files.

Human content, voice, visual and final-video gates remain source-bound and user-owned. Native release and actual provider/media acceptance remain separate checks.
