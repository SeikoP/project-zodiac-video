# Zodiac Agent-Native Creative Studio — Architecture Design Spec

> Status: PROPOSED / SPEC ONLY. No runtime implementation, migration, creative approval, or release is authorized by this document.
>
> Date: 2026-11-14. Baseline: SeikoP/project-zodiac-video main @ fa457a9351c33ace1da66bd089af8a1861e53838.
>
> Method: problem framing → constraints → alternatives → architecture decisions → contracts → acceptance gates → rollout. Implementation plans and TDD come after review.

## 1. Problem and outcome

Zodiac currently produces Web Phase 1 creative content and an immutable, approval-bound handoff, then runs Local Phase 2–3 with canonical Visual Intent, native validation, compilation, preview and final rendering. The desktop Qt application and Studio V2 can manage jobs and media but do not yet jointly offer an editable, authoritative project, a continuously updating timeline, or an agent edit protocol.

The intended product is **one durable creative project** simultaneously operated by a human in Studio and an AI agent through structured commands. Both observe the same revisions and real preview. Users can edit narration after import, manage assets, adjust scenes/timing, and review a scene while the rest is still under construction. Phase 1 creative authoring stays in ChatGPT Web; Phase 2–3 are integrated into the Studio project.

This is not a request to rewrite every compiler. The biggest new components are a project/revision engine, transactional command API, draft validation and approval lifecycle, incremental preview scheduler, and agent bridge.

### Measurable outcomes

1. Import an approved Phase 1 v2 capsule into a new Studio project without rewriting or invalidating its immutable source.
2. Edit a bounded narration segment **after import**, retain a traceable before/after, and safely create a new approval-bound revision. Only necessary technical artifacts rebuild; semantic story dependencies receive editorial review.
3. Agent can create/update one scene or asset via an API. Studio timeline/preview reflect the newest valid state without final MP4 rendering.
4. Human and agent edits cannot silently overwrite one another; undo, conflict handling, event replay and crash recovery work.
5. Preview and final output share rendering primitives and are tested for parity. Draft placeholder states are clearly distinguished from renderer-faithful states.
6. Preserve voice-first creative quality, actual human approval, Job@5 compatibility, version pinning, asset provenance, deterministic contracts and cache reuse.

## 2. Verified baseline and current constraints

Current source to preserve:

- Web Phase 1: Evidence → Voice → Concept → Narrative Design → Narration → Content Review, defined in orchestration/phases/01-content.md. Web should not bootstrap native tooling or issue fake validator receipts.
- Handoff: zodiac-phase1-handoff@2, immutable content-review receipt bound to hashes of narration, narrative plan, episode scope, writer brief and voice profile. Export rejects CONTENT_APPROVAL_SOURCE_DRIFT. Local imports v1/v2 and reconstructs native Phase 1 state for v2.
- Phase 2: .authoring/visual-intent.json (zodiac-visual-intent@1) is the single agent-authored visual canonical source. Compiler projections such as production.json, asset-plan.json and visual grammar must NOT be edited directly.
- Incremental cache: phase02-semantic-cache already tracks scene/asset/preview dirty closure. Studio V2 already has artifact graph, per-scene TTS and per-scene timing cache.
- Studio: tools/studio_qt is a PySide6 job/workbench/media interface, not an end-to-end semantic timeline editor. tools/studio_v2 is executor/session/pipeline infrastructure. Existing Remotion scripts can launch a real renderer preview, but this is not a controlled bi-directional live authoring protocol.
- Older docs/ZODIAC_STUDIO_REFACTOR_SPEC.md proposes Tauri/React + Python engine; it is partially historical (Tkinter and old runtime assumptions). This spec supersedes its **interaction, revision and agent-integration decisions**, not its tested functionality.

### Architectural invariants

- **One canonical owner per authored field.** Content revisions own narration/voice-profile/plan edits; Visual Intent owns scene composition and authored visual events; timing-adjustment source owns manual timing edits. Compiler outputs remain derived.
- Studio project graph is an **index, revision ledger and coordinator**, NOT a second editable copy of Visual Intent.
- Never treat a handoff ZIP, approved snapshot, compiler-owned projection, render-plan.json, generated asset or review receipt as a scratch file.
- Preserve stable IDs across content beats, semantic units, scenes, entities and events. Explicit migrations are needed when splitting/merging IDs.
- Human content approval, human visual review, deterministic native PASS, and final audiovisual QA are distinct evidence types.
- Do not manufacture approvals, reuse approvals against edited bytes, or infer creative quality from deterministic validators.
- Keep the three public phases. Studio can have many internal working states without adding public phase complexity.
- No mandatory prop/effect quotas, Scene Set resurrection, decorative Narrative Visuals, or duplicate Story Text and Narrative Visual in the same scene.

## 3. Main architecture decision

~~~text
Phase 1 Web — creative authoring + explicit Content Review
    ↓ approved, hash-bound handoff@2 (immutable import)
Studio Engine (Python domain orchestration; project/revisions)
    ├── Content revisions and approval ledger
    ├── Visual Intent + timeline authoring transactions
    ├── Asset registry + provenance
    ├── Command/patch API + event stream
    ├── Dependency DAG + incremental scheduler
    └── Draft/validated/rendered artifact graph
         ↕                  ↕
Human Studio UI          Local CLI / MCP Agent adapter
         ↘                  ↙
        Shared Remotion render core + Player
                    ↓
       Measured TTS/timing, FFmpeg, MP4 QA, export
~~~

Start with one local engine process, local-only commands and events. An in-process command adapter should also be callable by current Python/CLI entrypoints. A local WebSocket (or HTTP commands + WebSocket events) is a transport; it is not the domain model. MCP is an adapter for agents, not the authoritative store.

### Desktop decision

**Do not block the core refactor on an immediate Tauri migration.** First prove the command API, editable project, and real preview with a local web UI or bridge from current Qt workbench. Once contracts are stable, migrate toward React/TypeScript frontend + optionally Tauri shell while retaining Python engine. Avoid two competing canonical desktop editors. Retire Qt functionality only after parity and migration tests.

### Alternatives rejected

- Put a new editor on top of immutable Job@5 ZIP or render-plan.json: too late; source ownership and regeneration become ambiguous.
- Let agent write arbitrary JSON/files then notify Studio: bypasses transactions, approval-boundaries, leases, revisions and safe invalidation.
- Rebuild the entire project on every narration edit: expensive and unnecessary for lexical edits; still insufficient for judging changed story meaning.
- Automatically preserve old Content Review approval when any approved source changes: invalid and currently explicitly blocked.
- Make all editing occur through ChatGPT Web with no local agent: local Studio on localhost is not directly reachable from arbitrary remote Web chat.
- Build full collaborative multi-user CRDT infrastructure at launch: premature; use optimistic revision checks and short bounded leases.

## 4. Phase 1 validation and post-handoff narration editing

### 4.1 Separate three kinds of validation

1. **Draft checks (cheap, repeatable):** shape, spoken text normalization, missing content, known forbidden tokens/style restrictions, structural beat coverage, estimated duration if required by the current brief. Nonblocking warnings can surface inline; no native runtime receipt.
2. **Editorial review:** human/agent-assisted semantic judgment for voice, hook, recognition, progression, story logic, payoff and actual voiced-read quality. Agent may evaluate and suggest; only an explicit user act creates the approval evidence required by the boundary.
3. **Native production validation:** import checks, compiler contracts, IDs, asset dependencies, spatial layout, preview/render parity, audio measurements and export checks. These are Local responsibilities; do not drag native compiler execution into Web Phase 1.

Progressive checks may exist in source, but Web Phase 1 does **not** need to load or execute them as a mandatory native authoring pipeline. At Web Content Review, the exact final canonical bytes and meaningful editorial criteria are presented once. Never label a provisional draft PASS as an approved final.

### 4.2 Imported snapshot and working branch

On v2 handoff import:

- Save exact original bytes, inventory, manifest, SHA256SUMS and receipt in a read-only imported snapshot.
- Verify approval/hash binding BEFORE creating project state.
- Create a working revision derived from this snapshot, with content and visual documents independently versioned.
- Keep a ledger: imported revision ID, current head, parent ID, author, command, timestamp, base revision and source fingerprint.
- Old approval is evidence for the old snapshot only. It is not copied to a changed content revision.
- If an imported project is reopened, resume its current working revision rather than importing destructively.

Proposed content lifecycle:

~~~text
IMPORTED_APPROVED (immutable)
  → WORKING_DRAFT (user/agent edits)
  → VALIDATION_READY (cheap structural checks pass)
  → CONTENT_REVIEW_REQUIRED (meaning/voice approved sources changed)
  → APPROVED_REVISION (new explicit user approval + hash binding)
  → PRODUCTION_READY
~~~

A new approved revision has a **new** content-review receipt referencing the new exact source hashes and explicit user action. It does not claim that the original Web handoff was edited or that the user's approval from Phase 1 magically applies to it. A source-only lexical edit still requires a new approval at the changed content boundary, but need not rerun full research/ideation.

### 4.3 Stable script segmentation

Introduce a semantic narration-document authoring format with stable IDs:

~~~json
{
  "format": "zodiac-narration-document@1",
  "segments": [
    {
      "id": "beat-03-line-02",
      "text": "Ví dụ lời kể...",
      "beat_id": "beat-03",
      "voice_profile_ref": "voice-profile:rev-1"
    }
  ]
}
~~~

This is a proposed **new Studio source contract**, not evidence that the current handoff includes these IDs. On import, derive initial stable segments from narration and the narrative plan; do not pretend automatic mapping is always exact. If mapping is ambiguous, require a user/agent review instead of falsely preserving anchors. A deterministic serializer materializes narration.txt for existing downstream contracts. Normalization must not silently change approved bytes.

### 4.4 Edit classification and impact

A command modifying narration MUST capture old/new text, affected semantic segment IDs, scene/beat dependencies, and an impact classification:

| Edit type | Technical response | Editorial response |
| --- | --- | --- |
| Punctuation / orthography with same spoken bytes | Recompute hashes; TTS reuses only if actual TTS normalized input and settings truly unchanged | Reapprove changed canonical text; compact targeted review |
| Reword sentence, same intention | Invalidate owning speech unit, voice/timing/caption and dependent absolute placements; preserve independent assets | Review voice and payoff continuity |
| Change claim, joke, beat intent or meaning | Invalidate semantics and visual relationships in affected beats and callbacks | Review story spine, linked scenes and affected narrative visuals |
| Split/merge/reorder beats | Rebind stable IDs or record explicit migration; recalibrate audio/video ordering | Broader editorial review required |
| Change voice profile | Invalidate TTS units sharing voice profile and subsequent timing | Voice review |
| Change only visual/asset | No content approval invalidation | Visual review for changed scene/asset |
| Change only music | Audio mix and final QA | No narration review |

Do not trust the model's semantic-neutral label as proof: the edit-classification verdict is advisory until native checks and human review resolve required checks. Use two graphs: **technical invalidation** (hash/dependencies) and **editorial impact** (beat callbacks, tone, concept, story focus, approval).

For durations, regenerated speech can shift later absolute timeline positions. Recompute the cumulative offsets and caption positions, but do not regenerate independent later TTS/audio or assets solely because their absolute time shifted. If segmentation or alignment cannot be guaranteed, escalate scoped regeneration.

### 4.5 Mid-render edits

A render job always reads a fixed immutable build snapshot. Editing during render creates a newer working revision; it does not mutate the running renderer's input. Mark older output as produced-from-revision-N, never current. Offer cancel/rebuild from changed revision or retain the old export as historical evidence.

## 5. Studio project, timeline and asset model

### 5.1 Project structure (illustrative, not mandatory directory migration)

~~~text
projects/<project-id>/
  project.json                   # IDs, current revision pointers
  imports/<handoff-id>/          # pristine original v1/v2 ZIP + inventory
  revisions/<revision-id>/
    content/narration-document.json
    content/narration.txt
    content/narrative-plan.json
    content/voice-profile.json
    visual/.authoring/visual-intent.json
    timing/timing-overrides.json # only if edited
    revision.json                # parents, dependency hashes, approval refs
  events/                        # append-only revision/command log
  artifacts/<hash>/              # generated, immutable by hash
  cache/                         # content-addressed
  exports/<run-id>/              # exact source-revision lineage
~~~

Keep existing .authoring workspace layout as a compatibility materialization, owned by Studio Engine. Do not create two writable copies in production; a transaction commits source first, then derived materializations atomically or via journal recovery.

### 5.2 Timeline and scene editor

Timeline lanes: narration/voice, captions, actor states, props, scene accent/background, optional Narrative Visual, Story Text, motion/camera, music and audio mix. Rows and clips reference semantic owner IDs, source anchors and frame/time ranges. The timeline is a **view/editor of authored intents and explicit overrides**, NOT a second graph privately serialized by React.

Editor support: scene inspector; actor/cast identity and hair; transform/placement; event states; asset references; clip start/end and easing; caption layout; audio audition; visible invalidation warnings; source vs built vs approved badges.

Derived outputs: production.json, render-plan.json and measured timing are not manually writable. Edits must be made to the correct canonical intent or timing override source and projected through compiler.

### 5.3 Asset library 2.0

Index asset ID, content hash, category, provenance, license/usage, compatibility, previews, selected state variants, original/generation intent, character identity bindings, scene references and source revisions. Deduplicate by content hash without merging semantic identity. Do not delete active referenced assets. Separate ephemeral generated previews and approved reusable library assets; import legacy asset packs via explicit migration, no blanket reactivation of retired Scene Sets.

## 6. Agent bridge contract

### 6.1 One API for human and agent

Command transport independent of model or UI. Recommended commands:

- project.open, project.get_state, project.list_revisions, project.checkout_revision
- content.get_segments, content.propose_patch, content.apply_patch, content.request_review, content.approve_revision
- scene.list, scene.inspect, scene.apply_patch, timeline.inspect, timeline.apply_patch
- asset.search, asset.inspect, asset.import, asset.generate, asset.replace_reference
- build.preview_frame, build.preview_scene, build.validate, build.export
- agent.get_context_capsule, task.claim, task.release, command.undo, events.subscribe

No generic unvalidated filesystem write operation exposed to model. Content approval command must require a trusted human UI/user action; an agent may request approval but cannot call content.approve_revision on its own.

### 6.2 Transaction semantics

Each write includes:

~~~json
{
  "protocol": "zodiac-studio/next",
  "command_id": "cmd-unique-id",
  "project_id": "project-123",
  "base_revision": "rev-004",
  "scope": {"scene_ids": ["S03"], "entities": ["actor-taurus"]},
  "operation": "scene.apply_patch",
  "patch": [{"op": "replace", "path": "/scenes/S03/events/event-07/start_anchor", "value": "beat-03-line-02"}],
  "idempotency_key": "agent-run-x-cmd-07"
}
~~~

Use semantic-ID-addressed patch paths or domain operations, not fragile JSON array indices. The server verifies scope, authorizations, source ownership, expected revision, referential integrity, and mutation constraints. It returns committed revision and typed dirty nodes (or structured error). Transaction is atomic and durable; retry with same idempotency key cannot duplicate edits.

If head changed since base_revision, either rebase a genuinely disjoint patch verified by engine or return REVISION_CONFLICT with a small diff and fresh context capsule. No last-writer-wins on overlapping content. A scoped lease may temporarily prevent simultaneous destructive writes, but never strands project state after crash.

### 6.3 Events and hot reload

Examples: revision.committed, source.invalidated, asset.ready, scene.preview_ready, timeline.updated, build.progress, validation.failed, review.required, export.ready.

Events have project_id, revision_id, monotonic sequence, changed IDs, dirty closure and artifact hashes. UI/agent reconnect with sequence cursor and receive replay or a fresh authoritative snapshot. Debounce rapid editor changes, cancel superseded preview work, prioritize visible scene, never cancel a user's explicitly pinned export without instruction.

Preview fidelity states: PLACEHOLDER, DRAFT, NATIVE_READY, VERIFIED. Placeholder is visually distinct and never marked verified. Current Remotion composition should be refactored into a shared render core consumed by interactive preview and final render; parity tests are mandatory. Do not maintain an unrelated HTML approximation as the final quality preview.

### 6.4 Agent context and cost

Provide a small task-scoped capsule: approved content revision reference, relevant beat text, voice constraints, active scene intent, required asset IDs/available variants, scene-preview frame, recent failed checks, and dirty closure. Lazy-fetch full catalogs; no complete repository tree per task. Support run-scoped compiler/runtime hash pinning and receipt IDs. Track tool round trips, tokens loaded, change-to-visible-preview latency, cache hit rate, scene revisions and final quality outcomes.

### 6.5 Remote ChatGPT limitation

Local CLI connected to the engine can call it directly. A ChatGPT Web plugin cannot assume access to 127.0.0.1 on a user's machine. Any Web bridge needs explicit user-configured trusted transport/connection, authentication, local consent and a clear online/offline signal. Start with local CLI; evaluate a remote bridge only when data security and useful workflows justify it. Default local listener should be loopback-only, authenticated, and resistant to cross-origin access; do not expose arbitrary filesystem paths or shell commands.

## 7. Effectiveness hypothesis and measurement

The agent bridge is **not intrinsically faster** than current CLI/source editing. It adds transport, synchronization, schema and UI work. It should be justified by fewer authoring cycles and better quality control.

| Dimension | Current pattern | Proposed pattern | Required benchmark |
| --- | --- | --- | --- |
| Initial Phase 1 creative | Web voice-first; efficient | Keep existing Web path | No regression |
| First full video creation | Local authoring, native compile, review, final render | Same compilers plus per-scene visible progress | Compare full elapsed and result quality |
| Edit a single scene | File/source diff, re-run relevant commands, separate preview | Bounded patch, dirty graph, automatic preview | Measure edit-to-preview p50/p95 and work reused |
| Small narration edit | Approval hash drift blocks direct production | Controlled content revision, scoped audio and review | Measure manual steps, generated TTS units, outcome |
| Human correction | External chat instructions and source edits | Direct inspector/timeline edit with agent revision awareness | Compare number of correction cycles |
| Fault recovery | Native receipts/logs and workspace | Structured scene-level errors plus history/undo | Compare recovery time, no false PASS |

Pilot should use same input and acceptance rubric on at least: one fresh episode, one one-sentence narration change, one multi-beat semantic rewrite, one visual S03 asset replacement, one agent/human concurrent edit, and one interrupted build. Record real wall-clock and quality outcomes, not fabricated speedup percentages.

**Go/no-go criterion:** retain new bridge only if correctness/creative review are maintained and scoped edit workloads reduce user effort and/or measurable time. If not, keep minimal Studio status/preview integration and continue efficient CLI authoring.

## 8. Implementation waves and test-first gates

### Wave 0 — contract inventory (spec review, then TDD plan)
- Identify canonical source owner for all current files, approval sources, native projections, and stale/legacy pathways.
- Freeze baseline fixtures on main (handoff v1/v2, Job@5, visual intent, Studio V2, real preview).
- Write rejection tests for mutating imported snapshot and compiler outputs.
- Preserve current main; implement only on feature branches; no plugin version bump before functional release.

### Wave 1 — project/revision and content edits
- Project import, immutable source snapshot, working revision journal, semantic content segments.
- Targeted authoring validation and explicit post-import reapproval.
- Tests: original handoff remains valid; changed content loses current-approval status; new trusted approval binds new hashes; crash resume; undo; stale write conflicts.

### Wave 2 — command protocol and incremental graph
- Shared domain commands; scoped optimistic transactions; typed events/replay.
- Integrate existing phase02-semantic-cache, StudioV2 ArtifactGraph, per-scene TTS and timing caches.
- Tests: unchanged scenes/assets reused, tampered outputs rejected, global timing positions recomputed after audio change, semantic impact flagged.

### Wave 3 — live preview and visual editing
- Shared Remotion render core and first interactive scene/timeline editor.
- Preview compiled and invalid draft states with explicit badges; no full MP4 requirement.
- Tests: frame parity, caption/asset/occlusion fidelity, hidden/pending asset behavior, resource limits on weak Windows laptop.

### Wave 4 — asset catalog and agent bridge
- Browse, tag, preview, use/replace/restrict assets; bounded scene commands.
- MCP adapter for local CLI; context capsule and concurrency reconciliation.
- Tests: asset provenance, multi-scene dependency invalidation, no generic arbitrary path writes, agent/human interleaving, request replay.

### Wave 5 — export integration and migration
- Stabilize Final QA, publish text, audio mix and Job@5 generation from a pinned project revision.
- Qt-to-new-UI parity migration only once stable, with rollback and legacy package recovery.
- Tests: Web v1/v2 → Studio → Job@5 → real Remotion/FFmpeg; copy/edit/undo/re-export, voice/timing fidelity and reproducibility; no duplicate public MP4 output.

## 9. Blocking acceptance cases

- A changed narration.txt never inherits an APPROVED receipt for its former SHA.
- User can amend one line of imported narration without going back to full concept research or manually recreating a handoff ZIP.
- Content review remains an explicit human boundary; no agent, validator or file edit automatically issues approval.
- Changing one S03 prop does not rebuild unrelated scenes unless a real shared dependency changed.
- A changed spoken sentence regenerates affected TTS and timing as needed; later global frame offsets may shift but unaffected TTS cache remains reusable.
- Scene preview becomes available progressively while other scenes remain pending; a user-visible DRAFT frame is never labeled VERIFIED.
- Human/agent simultaneous edits never silently lose data. Out-of-date command returns a recoverable conflict.
- Crash/restart preserves immutable imported source, last committed revision, task state and event cursor.
- Final rendering reads a fixed snapshot. Live edits cannot mutate a running export.
- Fresh production never revives Scene Set containment or misclassifies physical props as Narrative Visuals.
- Local import v1/v2, Job@5 and pinned renderer behavior remain compatible through adapters.
- Performance comparisons include full human/agent wall-clock and the quality of resulting video, not only compiler milliseconds.

## 10. Risks and open design decisions

1. **Speech segmentation:** exact alignment between imported narration/plan beats and production scenes is not guaranteed. Use stable IDs with explicit migration and fallback review.
2. **Semantic edit scope:** automated meaning-change estimation is advisory. Review callback/payoff and story-focus dependencies even when no file hash detects them.
3. **Qt vs Tauri:** commit the Engine/API contract first; decide shell after a real low-RAM prototype.
4. **Renderer live fidelity:** measured timing/audio may not exist at draft time. Render provisional time must be visibly different from measured final time.
5. **Review provenance:** Studio needs its own trusted UI approval receipt format linked to user action and approved bytes; never reuse generic agent API for it.
6. **Asset licensing:** generated/user-imported asset reusability and provenance need explicit policy.
7. **MCP vs direct CLI:** start local direct command API and a thin MCP adapter; benchmark before adding complex remote transport.

## 11. Decision summary

**Accept:** immutable Web handoff + editable revision branch; incremental content/technical/editorial invalidation; per-scene preview via shared rendering core; structured agent commands with optimistic concurrency; user-gated approval; staged migration; measurement-driven effectiveness decision.

**Reject:** rewriting all native compilers; unrestricted agent file edits; pass-through old content approval; rebuilding every scene on minor text edits; immediate wholesale UI rewrite; pretending local Studio is directly reachable from ChatGPT Web.

**Next artifact after design review:** an implementation plan with numbered TDD tasks, concrete code owners/files, red tests, acceptance checks, migration/rollback plan and a pilot fixture. This design document itself authorizes no implementation.
