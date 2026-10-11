# Three-phase router

The router owns order and review; manifests own step details.

## Flow
1. `01-content` — Evidence → Concept → Narration → CONTENT REVIEW.
2. `02-visual-production` — Visual Compile → Semantic Assets → Publish Prep → VISUAL REVIEW.
3. `03-handoff` — seal approved source → Job@5 Assemble → all production/static gates → one export and archive QC. No extra review.

## Execution bootstrap (before any phase)
Follow `orchestration/execution-bootstrap.md` and use `orchestration/restore-plugin-source.mjs` only when a verified plugin snapshot has actually been staged in CAAS. Confirm compiler source and required native assets exist **on the execution filesystem**, not merely in a plugin listing or read-only skill response. Run `node orchestration/execution-preflight.mjs <workspace> <phase>` after source restoration. An execution-preflight READY only permits proceeding to real compilers; it does not replace any phase gate.

Stop with `BLOCKED: SOURCE_UNAVAILABLE` if exact assets or tool dependencies cannot be restored. Do not re-label independently drawn SVGs as native assets or claim HTML-only preview parity. Use no fabricated receipts. Never retry an identical failing archive endlessly.

The state template `plugin_version` must equal root `plugin.json` version; existing approved content and user-message review remain unchanged. Source checks happen before phase execution and do not create a fourth phase.

## Source policy and recovery integrity (v2.3.2)
- Production must NEVER use Plugin Creator archive download or `get_plugin_files` as a source transport mechanism. Plugin Creator may be used only to update/publish the plugin. For GitHub fallback, sync and pin the source revision against the installed release **before** using GitHub artifacts. Compare version, root/overlay manifests, phase state template, and exact needed source files or release inventory. A coincident version alone does not prove full byte-for-byte equivalence.
- Phase 01 has a durable-write gate: before moving each step forward, create its actual authoring outputs plus real validator receipts and persist `pipeline-state.json`. A chat-only Narration is NOT a completed Phase 01. User approval records the genuine chat approval but cannot substitute for validator execution.
- Recovery from chat-approved Narration locks its byte checksum and creates missing upstream authored artifacts marked `reconstructed`, with independently verified evidence, genuine operations, and validators; never pretend an old run produced missing files. Do not introduce a new human approval if unchanged.
- Phase 02 source preflight and **Phase 02 authoring-input preflight** are distinct. First verify source, template, and state; then Visual Compile writes real `production.json`, `asset-plan.json`, `visual-grammar-plan.json`, `.authoring/character-assembly-plan.json` from the approved narration and native contracts. Only after this run strict `execution-preflight.mjs ... 02-visual-production --require-authoring-inputs` and then `phase02-execute.mjs --run`. Missing authoring inputs must cause real compilation to BLOCK, not fabricated files or fabricated receipts.

## Native Phase 02 execution command — v2.2.9

When the user resumes or asks to run Phase 02, **inspect the filesystem before re-planning creative assets**:

```bash
node orchestration/phase02-execute.mjs --workspace /absolute/job/path --source-root /absolute/plugin/root
node orchestration/phase02-execute.mjs --workspace /absolute/job/path --source-root /absolute/plugin/root --run
```

The optional `--snapshot <staged.json> --restore-target <plugin-root>` delegates to the existing `restore-plugin-source.mjs`. A skill URI, a connector read result, or a download URL is **not** a staged snapshot. No automatic connector→filesystem transfer exists. Do not continuously re-download inaccessible URLs; report exact paths in `.authoring/phase02-execution-receipt.json`.

The command checks installed source files, plugin/template version, workspace inputs, actual pipeline state and its native validator before running the in-order compilers. It writes `.authoring/phase02-native-checkpoints.json` only from successful Node executions, expected output receipts and validator-wrapper receipts. Reuse requires matching input/source/output SHA-256, not file names alone. `SKIPPED_REUSED` is execution reuse only; it never creates review approval, pipeline-state `PASS` or exporter permission. A `NATIVE_CORE_PASS_MANIFEST_REVIEW_REQUIRED` result means this core executor completed. The router must still run all Phase-02 manifest capabilities (including conditional meme/effect work), execute `build-native-preview-pairs.mjs <workspace>` and `validate-native-preview-pairs.mjs <workspace>` AFTER native compilers, inspect ALL event endpoint pairs made from exact native assets/layout, and secure explicit human Visual Review approval. Remotion preview is a **local runner** responsibility after Job@5 import, never a Phase-02 requirement. Core-executor status alone is **not** `VISUAL_REVIEW_PASS`.

When `.authoring/pipeline-state.json` is absent, preserve source creative files and return `PIPELINE_STATE_MISSING_NO_AUTO_APPROVAL`. Recover state only from actual approved user messages and existing operation receipts. A version migration requires an evidenced state migration; never silently rewrite state.version to make preflight pass. Existing three phases remain unchanged.

## Start / transition algorithm
1. Bootstrap a supplied series tracker if present, perform execution bootstrap, then validate `.authoring/pipeline-state.json`.
2. Load only the current phase manifest, current-step guidance and supplemental `load_references`; never reload a capability `guidance_uri`.
3. Execute entry capabilities while the step is `READY`, record real receipts, then set it `IN_PROGRESS`.
4. Build only the allow-listed `context_manifest`; deny-list wins.
5. Produce outputs, record material writes in `operations[]`, then execute exit compilers/validators in manifest order.
6. A required-review phase whose steps all pass becomes `IN_REVIEW`, not `PASS`.
7. After explicit user approval, append one user-message review receipt and revalidate before moving the phase to `PASS`.

## Capability proof
- external tool → `tool_result`
- external skill → `plugin_result`
- guidance skill → `skill_read` or `plugin_result`
- internal reference → `skill_read`
- internal compiler → `compiler_result`
- internal validator → `validator_result` plus a readable `zodiac-validator-receipt@1`

Internal validators MUST run through `orchestration/run-validator-with-receipt.mjs`. Pipeline-state validation verifies that the receipt's executed validator matches the manifest `tool_locator`.

## Content quality escalation (fresh 2.4.13+)
Concept must choose from three genuinely distinct, source-bounded premises (`concept-candidates.json`) with `narrative-plan.selected_concept_id`; `validate-content-contract.mjs` enforces this on fresh v2.4.13+ states. Independently challenge the full narration with `story-quality-review.json` and `validate-story-quality-review.mjs` through a genuine validator receipt. Deterministic PASS means artifact integrity, NOT measured creative quality; a weak premise reopens Concept. Retain existing approval and the three-phase workflow.

## Content enforcement
Evidence must pass `references/validate-evidence-contract.mjs` after fresh discovery/verification. Concept must pass `references/validate-content-contract.mjs`. Narration runs `validate-narrative.mjs` plus `validate-narrative-qc.mjs <narrative-qc.json> <narration.txt>`; semantic-QC evidence excerpts must occur in the actual narration.

## Character facial expression and cast identity (2.2.10)
The native v4 Character Assembly expression grammar is the only approved facial geometry source for this pipeline: small filled-dot eyes or soft smiling eye curves, with simple readable mouths. Do not revert to the old hollow almond/slit eyes or angular diamond-shaped mouths. Recompile existing baked SVG states if this grammar changes; never claim old SVGs are updated because the compiler changed.

Choose each character's hair by its story role and visual distinction. In school/classmate scenes, do not reuse a thief/criminal reference hairstyle unless the narration explicitly calls for that character. Record the hair choice once in `.authoring/character-assembly-plan.json` as a character identity field; propagate it to every compiled state, then re-run character, identity/outfit and visual-quality validators. **Do not globally forbid hair families** that remain useful for other stories.

## Story Object & Effect semantics — V1
For a new run, Phase 01 establishes the visual metaphor at Story Spine level. Phase 02 writes `.authoring/story-object-plan.json` BEFORE producing extra SVGs. See `references/story-object-effects.md`; `run-director-v2-review.mjs` enforces real object actions, supported tiered effects and payoff before native preview. Do not mark absence of a plan as Story Object PASS. Phase 03 fingerprints this plan with reviewed assets and checks it before sealing/export; the plan never enters Job@5 ZIP.

## Visual enforcement
Before Phase-2 Visual Review, run `node orchestration/validate-authoring-scene-events.mjs <workspace>` against the actual `production.json`, not a sidecar event plan. Every nonempty scene voice must be embedded in the scene, and authored semantic events must be present as `scene.events`, with valid targets, state transitions, voice anchors and explicit motion duration. Fix source data, do not synthesize validator PASS. This local check does not replace Character Assembly, Environment/Scene Direction, Visual Quality, or runner parity.

Semantic Assets order is Character State Asset Planning (`--plan-only`) → Character Assembly write → identity/outfit validation → Environment Compile + binding validation → Scene Direction → Visual Quality. The state plan checks the default three-asset character budget before SVG generation. Planned identical keys share one output; never create SVGs and dedupe them afterward. Bedroom profile metadata alone is not completion: selected structural cues must exist as real package assets/entities before Scene Direction.

Meme compositions compile through the V4-owned template registry and adapter registry. Compile role bindings, acting requirements, caption slot and role boxes into native V4. Set `flags.meme_selected` before Semantic Assets. Bedroom, classroom and hallway environments use the V4 profile catalog; props and accessories come from the V4 catalogs.

Only compiled production with canonical V4 assets, complete authored entity/state/event/spatial bindings and executed native validator receipts can enter Phase-02 Visual Review. The non-optional native preview check produces `.authoring/preview-pairs/index.html` and `.authoring/preview-pairs/preview-report.json`, with exactly two authored endpoints per event. Any missing pair or stale source hash must block review. An identical before/after SVG with a motion preset is a **motion-only** flag for local-runner temporal QA, never a fake geometry change or runner parity PASS. Review may inspect native SVGs and their authored layout/semantic choreography (including static contact sheets derived from those exact compiled assets); standalone hand-authored HTML or substitute SVGs never count as compiler/validator evidence. Explicit approval of the native visual design can complete the Phase-02 review **without** Remotion, measured timing or final-video evidence. Do not mistake native QC for runner-preview parity or final MP4 approval.

## Producer / local runner boundary — v2.2.11
- **Plugin Phase 02:** native asset/state/layout compilation; semantic prop/effect lifecycle; spatial/contact validation; Publish Prep; user review/approval of native visuals. No Remotion, TTS, measured timing, runtime frame screenshots or audio files; native two-endpoint semantic preview is mandatory.
- **Plugin Phase 03:** compile semantic Job@5 IR; validate schema, narration, assets, event intent, publish metadata and ZIP roundtrip; export exactly one ZIP. The final plugin gate is `LOCAL_RUNNER_IMPORT_READY` (import safety only).
- **Local runner after ZIP import:** synthesize/attach voice, measure word timing, resolve scene-event frames, compile the render plan, run Remotion Studio/stills or MP4 previews, render final video, mix audio/SFX, render cover and perform final listening/visual QA. The runner alone certifies preview/final parity.
- A missing local runner is **never** a producer-phase blocker. Do not create false runner receipts, bypass native validation or elevate an undelivered ZIP to a final rendered video.

## Handoff enforcement — production release v2.3.9
Handoff is a semantic boundary, not a renderer projection. Phase 3 converts the approved Phase-2 authoring payload into `zodiac-job@5` with `production.ir.json` and `design-token.json`, validates canonical contract hashes and removes legacy delivery files `production.json` / `design.md` before ZIP validation.

Every event must have explicit authored motion intent. Handoff may map that authored motion to `desired_motion`, but it MUST NOT invent runtime motion/performance defaults or resolved frame ranges. Timeline Compiler and Renderer 2 own execution after local import.

Run `run-phase03-production.mjs` with `.authoring/phase02-review-lock.json` and approved source; never use low-level exporter directly. Verify approved source/asset/publish checksums, phase approvals, spatial effect lifecycle, brand font, runner import and semantic P1=0 before ZIP. Export creates exactly one root-flat canonical-named ZIP, reopens it and requires `LOCAL_RUNNER_IMPORT_READY`. Stable `job.id` is sign+concept identity and remains unchanged across renamed patch ZIPs.

## Series tracker
A `zodiac-series-checklist@1` file is a ledger, not creative continuity. It does not switch `run_mode` by itself. Only the minimized final `series_selection` may enter creative steps; raw tracker/candidate-screen content remains isolated. A supplied tracker is updated separately only after ZIP_READY.

## Side effects
Content cannot create assets/render/package/ZIP. Visual Production cannot create ZIPs. Handoff Assemble/Validate cannot ZIP. Handoff Export owns the single ZIP. `zodiac-publish-bundle.zip` remains forbidden.

Motion QA 2.2.13: before visual approval, `semantic-motion-qa.mjs` is applied by the native pair compiler/validator. `hold` is static, `state_swap` cannot be a no-op, and `slide` must resolve a bounded contact trajectory to its semantic anchor. Expected peak amplitudes and before/peak visual cues are schematic; actual timing/easing stays with local runner. Changing any approved event reopens review for modified semantics.

## Release 2.4.48 native routing
Fresh start reads actual live release/source entry and verifies loaded-entry-identity.json (plugin_version and actual loaded_entry bytes). Do not trust a cached SKILL.md title or relabel old context. Use current_entry_identity receipt before Evidence. Source reload is explicit; this does not claim to flush plugin-provider caches.

Phase1 follows references/phase01-briefing.md and references/plugin-use-playbook.md. Resolve actual provider availability via resolve-capability-route.mjs; plan != execution. Current context loader accepts fresh/continuity plus draft/review roles. Native commit-phase01-step owns durable step progression, not user approval.

Phase3 manifests describe owned substages; invoke only run-phase03-production.mjs against approved source and review lock. Do not independently recompile substages or export a staged ZIP. ZIP-bound handoff receipt lists actual archive checks and pending runner media evidence.

Scoped Episode: fresh 2.4.50+ sets `flags.episode_selected=true` before Evidence; read `../references/episode-formats.md`. Carry research-scope → episode-scope → Narrative 2.1 with selected member lenses. Keep only selected context in draft/review. Preserve old approved single-sign 2.0.

## Source and recovery ruling
Production uses the local installed plugin root verified by plugin.json, or a checksummed restored snapshot. Plugin Creator transport is for inspecting/updating source, not an additional production authoring route. Active authoring leases never expire by elapsed time alone: diagnose owner availability and recover explicitly. Approval binds source_hashes narration/plan/scope/brief when recorded; never synthesize review. A verified Phase3 ZIP may be reconciled from its checksum and native substages without creating another ZIP. ZIP readiness does not prove runner media; manifest receipt completion remains separate.

After an explicit user Content Review, record the existing user_message proof via buildSourceBoundReviewReceipt in approval-source-hashes.mjs; commit source_hashes with that receipt. This helper binds evidence and cannot replace user approval. New visual-intent runs require this binding. Existing legacy approvals are retained as legacy, never silently migrated. Phase3 commits native owned substages, actual execution receipts and ZIP identity atomically after export; recovery commits state only and keeps runner media pending.

Release 2.4.51 authoring: for a complete visual-intent@1 pass it to write-phase02-authoring.mjs. A populated cast requires the actual episode-cast-plan; no placeholder is inferred. For an editorially approved omitted object, explicitly configure story_object_required=false before writing the intent; conflicting required flags block. Projections are derived inputs and must not be edited independently. Native compiler output hashes are recorded in the execution receipt and checked on resume.

If Phase3 publishes the checked ZIP but reports RECOVERY_REQUIRED, run `node orchestration/commit-phase03-release.mjs <approved-workspace> <saved-handoff-receipt.json> <existing.zip>`. It checks ZIP CRC/root, source review lock, executed validator receipts and state hashes, then commits state only. Preserve the existing ZIP. This does not approve source revisions or certify runner media.

## Current transition and transport ownership
At Phase1 exit/Phase2 resume, run phase02-transition-gate.mjs and read its handoff_context (authority, hashes, scope/Spine, creative_direction, actual review refs and next action). Recover evidenced approvals rather than asking again; no fake PASS. GitHub is executable source transport from SeikoP/project-zodiac-video at a pinned compatible release, never a replacement creative brief. See execution-bootstrap.md.
