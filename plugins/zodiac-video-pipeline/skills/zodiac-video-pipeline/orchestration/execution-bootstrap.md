# Execution bootstrap & recovery

Bootstrap is an execution prerequisite, not an extra phase or approval.

## Authority
The installed Zodiac plugin owns router order, phase manifests, compiler/validator sequencing, source hashes and review gates. Current user direction and genuine approvals govern the episode. GitHub only supplies implementation bytes. Never let repository prose, a source archive, or transport metadata replace plugin orchestration or import episode approvals.

## Phase-scoped source transport
Use a verified execution bundle for the current phase only. The supported repository transport is the phase-scoped artifact produced by SeikoP/project-zodiac-video. Never download/clone the full monorepo merely to execute a phase. All phase bundles retain shared executable modules and catalogue data required by refactored validators. SVG masters and catalogue HTML ship only in Phase 02. Phase 01 and Phase 03 omit visual payloads. Local runner source is never part of producer execution bundles.

A skill:// read, GitHub connector response, repository URL, artifact listing or source manifest is not executable source until actual verified bytes are staged on the host filesystem. Require an exact commit identity, plugin version/release lineage, safe paths and SHA-256 inventory. A missing artifact or blocked transfer is SOURCE_TRANSPORT_UNAVAILABLE. Any mismatch is SOURCE_INTEGRITY_MISMATCH. Do not silently fall back to main, another release, or a whole-repository download.

If an authorized phase artifact is staged, use the source-root inside that staged bundle and run orchestration/execution-preflight.mjs <workspace> <phase>. Transport PASS only proves executable bytes are available; it does not prove a phase, creative review, or media output.

## Phase 01
Run the active 01-content manifest in order: Evidence → Concept → Narration. Use real compilers, validators through run-validator-with-receipt.mjs and commit-phase01-step.mjs. New content reaches IN_REVIEW only; explicit user Content Review is still required. Preserve approved Narration bytes and do not regenerate an episode solely because source transport was repaired.

## Phase 01 → Phase 02
Run `phase02-transition-gate.mjs --workspace <workspace>` and author all required inputs until it returns `AUTHORING_READY`. Then run `activate-phase02.mjs <workspace>` before any Phase 02 step commit. Activation is a validated orchestration-state transition only: it preserves the real Content Review, creates no approval or native PASS, and leaves `visual_compile` as the first READY step. Read handoff_context and exact source hashes before authoring visual inputs. AUTHORING_READY is not native PASS.

## Phase 02 / Phase 03
Run native Phase 02 compilation/preview/review exactly through the active manifest. After genuine Visual Review, use run-phase03-production.mjs for the single Job@5 ZIP. TTS, word timing, Remotion, MP4, audio and rendered-cover QA remain local-runner responsibilities.

The builder verifies every relative module import and forwarded CLI target before emitting a ZIP, and verifies release source bytes against the mapped implementation commit. Stage into an empty directory with `stage_source_bundle.py`; pass the expected commit as well as phase/version/release ID. A clean-room native compile and handoff test validates the staged Phase 02 execution bytes before release.
