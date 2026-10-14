# Studio Production Checklist — Design

## Goal

Give the creator one Studio screen to remember which Zodiac episodes and signs are being worked on, the plugin phase and step where each workspace stopped, and the local Runner job and cover image associated with an episode. The screen complements the plugin's current `defaultPrompt`; it does not replace the plugin's creative or workflow authority.

## Decisions

- Add a **Checklist sản xuất** tab to the current `tools/studio_qt` GUI.
- The checklist contains only authoring workspaces the user explicitly registers. One row represents one episode workspace and shows its signs, working title/topic, an explicitly selected concept when available, and phase, step, and state read from that workspace.
- The plugin remains the source of truth for phase ordering and labels. Read the current phase manifests and `.authoring/pipeline-state.json`; do not duplicate a stale phase map in Studio.
- Read episode identity/topic from the plugin's authoring scope. Show a concept only when an authoring artifact explicitly identifies it as selected. An absent or unselected concept is shown as **Chưa chốt** and does not block tracking.
- The creator may explicitly link one local `zodiac-series-checklist.json` to the checklist. Show its 12-sign completion ledger using the existing checklist contract. A sign is complete only when that contract records it as complete. Do not search for or infer a tracker path. If no tracker is linked, report that no series ledger is linked.
- Users explicitly link a local Runner Job@5 to an episode. Do not infer a link from title, sign, hashes, or directory names. Job@5 remains unchanged and does not gain authoring metadata.
- Each row has a Cover preview card. Preview the linked job's actual `out/cover.png`; if no job is linked or the image is absent, show that state in the card. This is a GUI preview and does not alter the rendered artwork or approve the cover.
- Add a Studio-wide show/hide setting for the Cover card. Store it with checklist preferences, separate from per-job GUI settings. The concept remains optional regardless of this setting.
- Provide a **Sao chép prompt tiếp tục** action that copies the current plugin `defaultPrompt` text and a read-only episode snapshot: workspace/episode identity, format, signs, title/topic, selected concept or **Chưa chốt**, phase/step state, current step contract, explicit Job@5 link, and completion recorded by the explicitly linked 12-sign tracker. For a multi-sign episode, show how many of its members are marked `done` in that ledger as well as the overall ledger count. Tell the agent to re-read current workspace state and derive the first incomplete step from the active manifest; the clipboard snapshot is not authority, approval, or permission to skip a gate. Do not invoke the plugin or edit source artifacts from Studio.
- The checklist may add and remove references to tracked workspaces and save explicit Runner job links. Removing a reference must not delete or modify its workspace or job.

## Data ownership and error handling

- Checklist preferences contain only registered workspace paths, explicit workspace-to-job links, the optional explicit series-tracker path, and the Cover visibility setting. They do not contain phase state, narration, creative choices, review receipts, or approval state.
- Read authoring workspaces, plugin manifests/state, the explicitly linked series ledger, Runner job metadata, and cover images without writing to them.
- Write Studio preferences transactionally so an interrupted update cannot leave a partial configuration.
- Show missing workspaces, missing or malformed state/tracker, unsupported schema, and plugin/state version mismatches as visible diagnostics. Do not repair source files, silently fall back to guessed state, or present an error as PASS.
- If a linked job is missing or its cover has not rendered, keep the explicit link visible and show a placeholder/error in the card; do not silently relink it.

## UI behavior

- The checklist is a separate top-level tab alongside the existing Workspace and Media tabs.
- Users can register an existing plugin authoring workspace and explicitly link or unlink one of the locally available Runner jobs.
- Users can explicitly select or unlink one local `zodiac-series-checklist.json`; the UI shows whether a tracker is linked and its recorded completion summary.
- Each episode row presents the Zodiac member labels, title/topic, concept state, and current phase/step/state. The linked series ledger is presented separately so its sign statuses are not mistaken for an individual episode's workflow state.
- Cover preview visibility is controlled by one persisted Studio-wide setting. Hiding the card does not remove its job link or any media.
- The handoff action includes the current `defaultPrompt`, episode metadata, trustworthy ledger progress and manifest-derived step contract. It tells the agent to re-read the source and follow the installed router; the user continues in the plugin.

## Implementation boundaries

- Extend the `ZodiacQtApp` tab wiring in `tools/studio_qt/app.py` and add a checklist screen under `tools/studio_qt/screens/`, following existing Qt patterns.
- Keep discovery/parsing read-only and scoped to user-registered paths. Read phase labels from the installed/current plugin manifests and status from each workspace's authoring state.
- Store only checklist preferences under the configured Studio workspace, in a file separate from the per-job `.runtime/gui-settings.json` files. Preferences include the optional tracker path.
- Use the existing local Media/Runner job inventory for the explicit Job@5 picker and the linked job's `out/cover.png` for preview.
- Do not change plugin `defaultPrompt`, authoring contracts, phase state, approval rules, Job@5 package/import contracts, Runner execution, or rendered cover composition as part of this feature.
- Do not add automatic episode/job matching, plugin invocation, automatic sign planning, concept generation, or creative approval.

## Acceptance checks

1. Register multiple episode workspaces, including Gemini and Libra, and show each workspace's own authoritative phase/step without mixing their metadata.
2. Show one episode with an explicitly selected concept and another with **Chưa chốt**; concept absence remains valid.
3. Show sign labels and topic/title from the episode authoring scope; do not fabricate values when the scope is absent or invalid.
4. Without a linked tracker, show “Chưa liên kết series checklist.” After explicitly selecting a tracker, recognize only completion recorded under its existing contract. A selected but missing, malformed, or unsupported tracker produces a diagnostic, not guessed sign statuses.
5. Explicitly link a local Job@5 and preview its actual cover pixels; unlinked jobs and missing `cover.png` display clear placeholders. Similar titles/signs must never create a link.
6. Link a tracker file, restart Studio, and verify the selected path and completion summary persist; unlinking it hides the summary without changing the file.
7. Hide and show the Cover card, restart Studio, and verify the setting persists without changing a job's per-job settings.
8. Remove a tracked reference and verify the workspace and Runner job remain untouched.
9. Exercise missing workspace/state, malformed JSON, unsupported schema, and plugin/state version mismatch. Each is visible and fail-closed; no source file is rewritten and no error is shown as PASS.
10. Copy a two-sign episode prompt with one member marked `done`; verify topic, selected concept state, `1/2` member progress, overall `1/12` progress, explicit Job@5 ID, the current `defaultPrompt`, and active-step manifest outputs/gates/capabilities are included. Confirm it directs the agent to re-read state and preserve approval gates.

## Phase resume and release

- Use the existing `phase-index.json`, phase manifests, pipeline state, `plan-step-context.mjs`, phase transition gates, and receipts. Do not create a second orchestrator or duplicate manifest rules.
- Make the copied handoff name the exact current step contract. The active plugin still resolves its next action from current state and manifest, validates outputs and receipts before step commits, and crosses phase boundaries only through the existing transition gates.
- Release plugin version `2.6.0` by synchronizing the root manifest, Codex manifest, and pipeline-state template. Preserve plugin identity, scope, current `defaultPrompt`, MCP/app binding, and supported compatibility consumers.
11. Verify the Job@5 package shape and renderer output contract are unchanged.

## Risks and limits

- Authoring workspaces and Runner jobs are stored separately, so episode-to-job association depends on an explicit user link.
- The series ledger is separate from both the authoring workspace and Job@5 package, so series completion appears only after the creator explicitly links the exported tracker file.
- A cover card can only preview a locally available rendered `cover.png`; it cannot establish editorial quality or approval.
- The plugin may evolve its state or scope schema. Studio must expose unsupported versions clearly and follow the current contracts rather than guessing.
- Copy-to-plugin is a user handoff, not direct ChatGPT/plugin integration.
