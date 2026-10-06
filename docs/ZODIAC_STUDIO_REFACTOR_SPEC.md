# Zodiac Studio Refactor Architecture Spec

Status: **PLANNED — specification only; no implementation in this change**  
Target repository: `SeikoP/project-zodiac-video`  
Target branch for implementation: feature branches derived from `main`  
Current exposed product scope after the refactor foundation: **Import ZIP → Render → Open final video**

---

## 1. Purpose

Zodiac Studio has outgrown a GUI-only refactor.

The current Tkinter application is still useful as a runner, but the project is moving toward:

- runtime `zodiac-remotion@1.16.0` Performance Engine;
- later actor rigs, causal choreography and richer timing;
- shared preview/render behavior;
- a future Performance Compiler in runtime 2.0;
- a visual editor and performance timeline.

The refactor must therefore establish the **long-term application architecture now**, while exposing only a small user-facing feature set initially.

This is **not an MVP architecture** and must not be designed to be discarded later.

---

## 2. Product scope

### 2.1 Exposed in the first new Studio UI

The initial new desktop UI exposes only:

1. Select/import a `zodiac-job@4` ZIP.
2. Validate/import it into a Studio project/workspace.
3. Render the project through the existing local pipeline.
4. Show structured progress.
5. Cancel/retry when supported.
6. Open `out/zodiac-story.mp4`.
7. Open the output folder.

The backend is still expected to perform all required work automatically:

```text
Import
→ package/security validation
→ runtime compatibility
→ TTS when required
→ voice concat
→ measured timing
→ runtime validation
→ renderer preparation
→ render
→ background-music mix when configured
→ final validation
→ out/zodiac-story.mp4
```

### 2.2 Planned but not exposed initially

The architecture must allow later addition of:

- project/history browser;
- run comparison;
- audio/voice/music settings;
- pipeline inspector;
- structured logs UI;
- embedded Remotion preview;
- scene editor;
- actor inspector;
- performance timeline;
- causal choreography graph;
- camera director;
- asset browser;
- runtime inspector;
- runtime 2.0 Performance Compiler;
- local worker pool / remote worker transport if ever required.

These future features must not require another top-level Studio rewrite.

---

## 3. Core architectural decision

Use:

```text
Tauri desktop shell
        ↓
React + TypeScript frontend
        ↓
versioned Studio Protocol
        ↓
Python Studio Engine
        ↓
Remotion runtime / FFmpeg / TTS / alignment
```

### 3.1 Tauri responsibilities

Tauri is a desktop shell and OS bridge only.

Allowed responsibilities:

- window lifecycle;
- native file/folder pickers;
- launching/monitoring the Python engine process;
- safe local IPC transport;
- open file/folder in OS;
- application updates later;
- desktop permissions and secure local integration.

Tauri/Rust must **not** own pipeline/domain logic.

### 3.2 React/TypeScript responsibilities

Frontend owns presentation and user interaction:

- workspace shell;
- project/render views;
- progress display;
- commands initiated by the user;
- state derived from backend events;
- later editor/timeline/preview interfaces.

Frontend must not import or reproduce Python pipeline implementation logic.

### 3.3 Python responsibilities

Python remains the application/domain engine.

It owns:

- package import;
- package validation;
- project/revision model;
- run model;
- pipeline DAG;
- artifact graph;
- invalidation;
- runtime registry;
- cache decisions;
- TTS;
- alignment;
- FFmpeg;
- Remotion process execution;
- persistence;
- structured errors;
- structured events.

### 3.4 Remotion responsibilities

Remotion owns actual visual rendering and runtime-specific compilation/render behavior.

Current target:

```text
zodiac-remotion@1.16.0
```

Future target:

```text
production.json
    ↓
Performance Compiler
    ↓
render-plan.json
    ↓
shared render-core
    ↓
Remotion render
```

---

## 4. Architectural rule: GUI must not know implementation details

The new UI must not directly import or depend on:

- `zodiac_local.py`;
- `StudioController`;
- `PipelineWorker`;
- `JobStateStore`;
- TTS implementations;
- Whisper/alignment implementations;
- FFmpeg command construction;
- Remotion helper internals;
- runtime filesystem layout.

The frontend communicates only through a **versioned Studio Protocol**.

Legacy Tkinter may continue to use old modules during migration, but the new frontend must not.

---

## 5. Studio Engine target structure

Target structure:

```text
studio_engine/
├── domain/
│   ├── project.py
│   ├── revision.py
│   ├── run.py
│   ├── pipeline.py
│   ├── artifact.py
│   ├── runtime.py
│   └── errors.py
│
├── application/
│   ├── import_project.py
│   ├── open_project.py
│   ├── start_run.py
│   ├── cancel_run.py
│   ├── retry_run.py
│   └── get_run_status.py
│
├── infrastructure/
│   ├── sqlite/
│   ├── filesystem/
│   ├── ffmpeg/
│   ├── remotion/
│   ├── vieneu/
│   └── whisper/
│
├── protocol/
│   ├── commands.py
│   ├── events.py
│   ├── messages.py
│   └── server.py
│
└── workers/
    ├── executor.py
    └── resources.py
```

No microservices are required.

The first implementation should still run as one local Python engine process.

---

## 6. Domain model

### 6.1 Project

A Project represents a durable creative workspace.

Example:

```text
Project: Gemini-Opinion-Draft
```

Project identity must not be the same thing as one render execution.

### 6.2 Revision

Importing a new package for the same project may create a new revision instead of replacing historical state silently.

Example:

```text
Project
├── Revision 1
├── Revision 2
└── Revision 3
```

A revision records the imported source fingerprint and package contract version.

### 6.3 Run

A Run represents one execution of one Project Revision.

Example:

```text
Revision 3
├── Run 41 — music A
├── Run 42 — music B
└── Run 43 — regenerated timing
```

A Run owns node execution state and produced artifacts.

---

## 7. Replace fixed step sequencing with a Pipeline DAG

The current ordered-step model is useful but should not remain the final architecture.

Target abstraction:

```text
PipelineNode
├── id
├── inputs
├── outputs
├── dependencies
├── fingerprint
├── executor
├── cache_policy
├── invalidation_policy
└── resource_requirements
```

Illustrative graph:

```text
                    production.json
                          │
               ┌──────────┴──────────┐
               ▼                     ▼
          TTS scenes            runtime validate
               │                     │
               ▼                     │
          voice.wav                  │
               │                     │
               ▼                     │
        measured timing              │
               └──────────┬──────────┘
                          ▼
                   compile render
                          │
                          ▼
                      render
                          │
                    pristine video
                          │
               ┌──────────┴──────────┐
               ▼                     ▼
             cover               music mix
                                      │
                                      ▼
                                 final video
```

### 7.1 Invalidation examples

Music change:

```text
music
  ↓
mix.final
```

must not rerun Remotion.

Transform/visual change:

```text
production
  ↓
compile/render
  ↓
mix.final
```

must not rerun TTS.

Narration change:

```text
narration
  ↓
TTS
  ↓
timing
  ↓
compile/render
  ↓
mix.final
```

The DAG must become the canonical dependency model.

---

## 8. Artifact Graph

Do not let individual modules decide cache validity only by testing file existence.

Introduce a canonical Artifact model:

```text
Artifact
├── id
├── type
├── path
├── content_hash
├── producer_node
├── producer_version
├── inputs_hash
├── created_at
├── validity
└── metadata
```

Candidate artifact IDs:

```text
source.production
source.package
voice.scene.S01
voice.scene.S02
voice.final
timing.words
runtime.compiled
render.pristine
video.final
cover.final
publish.metadata
validation.final
```

Artifacts may still be files on disk.

The database tracks metadata and validity; the media itself does not move into SQLite.

---

## 9. Persistence

Use SQLite for Studio state and metadata.

Recommended workspace:

```text
.zodiac-work/
├── studio.db
├── projects/
│   └── <project-id>/
│       ├── revisions/
│       ├── runtime/
│       ├── artifacts/
│       └── out/
└── cache/
```

Recommended tables:

```text
projects
project_revisions
runs
run_nodes
artifacts
runtime_versions
events
settings
```

Creative source files remain portable JSON/SVG files.

Do not store `production.json` or SVG bodies as opaque database-only data.

---

## 10. Versioned Studio Protocol

The Studio Protocol must be defined independently of transport.

Initial protocol identifier:

```text
zodiac-studio/1
```

Example command:

```json
{
  "protocol": "zodiac-studio/1",
  "type": "command",
  "id": "cmd-213",
  "command": "start_run",
  "payload": {
    "project_id": "p_123"
  }
}
```

Example event:

```json
{
  "protocol": "zodiac-studio/1",
  "type": "event",
  "event": "node_progress",
  "run_id": "run_92",
  "payload": {
    "node": "render.video",
    "progress": 0.61
  }
}
```

Initial command set should include:

```text
import_package
open_project
start_run
cancel_run
retry_run
get_run_status
open_output
```

Future commands may be added without changing the architecture.

---

## 11. Transport independence

Do not make the protocol itself depend on one IPC mechanism.

Initial transport may be:

```text
Tauri
  ↓
managed local Python process
  ↓
JSON message transport
```

Later it may become:

```text
Studio
  ↓
local socket / WebSocket
  ↓
persistent Studio Engine daemon
```

The domain/application layer must remain unchanged.

Remote workers are not currently required, but the engine must not prevent that evolution.

---

## 12. Structured events and errors

### 12.1 Events

Do not make UI state depend on parsing log strings.

Backend emits typed events.

Example:

```json
{
  "level": "info",
  "domain": "render",
  "code": "RENDER_STARTED",
  "run_id": "run_92",
  "node_id": "render.video",
  "data": {}
}
```

UI may localize/present this as:

```text
Đang kết xuất video
```

### 12.2 Errors

Errors must be structured.

Example:

```json
{
  "code": "RUNTIME_HASH_MISMATCH",
  "domain": "runtime",
  "severity": "blocking",
  "recoverable": true,
  "actions": ["repair_runtime"]
}
```

Do not expose raw Python exceptions as the primary frontend contract.

Raw traceback/details may still be recorded for diagnostics.

---

## 13. Resource and worker model

The first implementation may run with effective concurrency = 1.

The model should still support resource declarations.

Example:

```json
{
  "resources": {
    "cpu": 4,
    "gpu": false,
    "memory_mb": 2048
  }
}
```

Potential worker classes later:

```text
CPU queue
TTS queue
alignment queue
render queue
FFmpeg queue
```

Do not implement distributed rendering now.

Only avoid architectural assumptions that make it impossible later.

---

## 14. Canonical contracts

Create canonical schema ownership rather than separately hand-writing incompatible Python and TypeScript models.

Target:

```text
contracts/
├── production/
│   └── v2.schema.json
├── performance/
│   └── v1.schema.json
├── package/
│   └── zodiac-job-v4.schema.json
└── studio/
    ├── command.schema.json
    └── event.schema.json
```

Generate or derive:

- Python validation/types;
- TypeScript types;
- runtime validation bindings where appropriate.

Contract drift between Python, Studio and Remotion is a blocking defect.

---

## 15. Frontend architecture

Target:

```text
apps/studio-desktop/src/
├── app/
├── features/
│   ├── projects/
│   ├── render/
│   ├── runs/
│   ├── audio/
│   ├── editor/
│   ├── performance/
│   └── runtime/
├── entities/
│   ├── project/
│   ├── revision/
│   ├── run/
│   ├── artifact/
│   └── pipeline/
└── shared/
```

Recommended stack:

```text
Tauri
React
TypeScript
Vite
Zustand
JSON Schema-derived contracts
```

Do not make a component-folder-only architecture the main organizational model.

Features and domain entities are the primary boundaries.

---

## 16. Initial Studio shell

The first UI must already use a workspace architecture rather than a disposable import form.

Target shape:

```text
┌─────────────────────────────────────────────────┐
│ Zodiac Studio                        Run status │
├────────────┬────────────────────────────────────┤
│            │                                    │
│ Projects   │             Workspace              │
│            │                                    │
│ Gemini     │          Import / Render            │
│ Virgo      │                                    │
│ Scorpio    │                                    │
│            │                                    │
├────────────┴────────────────────────────────────┤
│ Current run / structured progress              │
└─────────────────────────────────────────────────┘
```

Initially only the Render workspace is active.

Future workspaces may add:

```text
Scenes
Performance
Audio
Runtime
Publish
```

without replacing the application shell.

---

## 17. Render Core

The current editor preview and final Remotion render must eventually stop being separate rendering systems.

Create a shared React render layer:

```text
packages/render-core/
├── Scene.tsx
├── Actor.tsx
├── SvgAsset.tsx
├── Captions.tsx
├── Performance.ts
├── Camera.tsx
└── VisualState.ts
```

Both consumers use it:

```text
Studio Preview
      ↓
 render-core
      ↑
Remotion Runtime
```

The render core must not depend on Tauri.

This is a prerequisite for a high-fidelity future visual editor.

---

## 18. Runtime 2.0 compatibility target

Runtime 1.16 currently introduces authored performance metadata.

Runtime 2.0 is expected to move toward:

```text
production.json
       ↓
Performance Compiler
       ↓
render-plan.json
       ↓
render-core
       ↓
Remotion
```

The Studio architecture must therefore support a future artifact such as:

```text
runtime.render_plan
```

and a future pipeline node such as:

```text
performance.compile
```

without changing the top-level Studio architecture.

Potential runtime-2.0 domains:

- actor rig;
- continuous actor state;
- gaze/focus;
- causal performance graph;
- camera direction;
- semantic timing;
- generated render plan.

Do not implement these in the Studio refactor foundation unless explicitly scheduled later.

---

## 19. Import operation

Import is a domain operation, not a raw unzip action.

Required flow:

```text
ZIP
 ↓
security validation
 ↓
package contract validation
 ↓
runtime compatibility
 ↓
content fingerprint
 ↓
project/revision resolution
 ↓
artifact registration
 ↓
import completed
```

Preserve existing package protections, including:

- path traversal checks;
- duplicate entry checks;
- supported package layout;
- file/size policy;
- runtime version validation;
- package fingerprinting.

Never mutate the imported source in place before validation succeeds.

---

## 20. Final output contract

Keep the current single-final-output behavior.

Public render output:

```text
out/
├── zodiac-story.mp4
├── cover.png
├── publish-copy.txt
├── publish.json
└── FINAL_VALIDATION.json
```

The Studio UI initially treats:

```text
out/zodiac-story.mp4
```

as the primary user-facing result.

A pristine pre-mix render may remain an internal cache artifact under Studio/runtime-owned storage.

Do not restore:

- `zodiac-story.with-music.mp4` as a second public result;
- `zodiac-publish-bundle.zip`.

---

## 21. Legacy migration strategy

Do not rewrite everything in one change.

Legacy Tkinter stays available until the replacement path reaches required parity.

Proposed target repo structure:

```text
project-zodiac-video/
├── apps/
│   └── studio-desktop/
│       ├── src/
│       ├── src-tauri/
│       └── package.json
├── packages/
│   ├── studio-contracts/
│   ├── production-contracts/
│   └── render-core/
├── studio_engine/
│   ├── domain/
│   ├── application/
│   ├── infrastructure/
│   ├── protocol/
│   └── workers/
├── runtime/
│   └── zodiac-remotion/
├── cli/
├── tests/
│   ├── contracts/
│   ├── engine/
│   ├── integration/
│   ├── runtime/
│   └── e2e/
└── tools/
    └── legacy/
```

Do not move legacy modules merely to satisfy this directory layout.

Only move/delete legacy code after replacement behavior is verified.

---

## 22. Refactor phases

The refactor order is by **boundary**, not by feature count.

### Phase A — Canonical contracts

Create ownership and generation strategy for:

- production;
- performance;
- package;
- Studio commands/events.

No GUI rewrite yet.

### Phase B — Studio Engine domain

Extract reusable domain/application behavior from legacy controllers without changing rendering behavior.

### Phase C — Pipeline DAG and Artifact Graph

Introduce DAG nodes, dependency fingerprints, artifacts and invalidation.

Legacy ordered pipeline may temporarily adapt onto the new DAG.

### Phase D — Persistence

Introduce SQLite project/run/artifact persistence and migration from legacy per-job state as needed.

### Phase E — Versioned Studio Protocol

Expose engine commands/events behind `zodiac-studio/1`.

Add contract tests.

### Phase F — Tauri + React shell

Create desktop shell and engine process lifecycle.

No editor migration.

### Phase G — Import + Render workspace

Expose only the first user-facing path:

```text
Import ZIP
→ Render
→ structured status/progress
→ Open video
```

This is the first usable release of the new Studio, but it sits on the final architecture.

### Phase H — Shared render-core

Extract renderer components shared by Studio preview and Remotion.

### Phase I — Editor migration

Replace Tk canvas/editor with browser/SVG/render-core based editor.

### Phase J — Performance workspace

Add performance timeline, actor/performance inspector and causal visualization.

### Phase K — Runtime 2.0 integration

Add Performance Compiler and Render Plan inspection when runtime 2.0 exists.

---

## 23. Explicit non-goals for the first implementation wave

Do not:

- rewrite pipeline/domain logic in Rust;
- implement a PySide6 intermediate GUI;
- copy the Tkinter UI 1:1 into React;
- expose all existing Studio settings immediately;
- build a full Editor immediately;
- build remote/distributed workers;
- create cloud infrastructure;
- introduce microservices;
- replace `production.json` with a database-only representation;
- make React execute individual Python scripts directly per button;
- make UI parse console strings as application state;
- delete Tkinter before replacement parity is verified.

---

## 24. Compatibility requirements

The refactor must preserve:

- existing valid `zodiac-job@4` packages;
- exact runtime resolution;
- runtime hash verification;
- `zodiac-remotion@1.16.0`;
- current TTS/alignment/render behavior unless changed in a dedicated feature;
- incremental invalidation semantics;
- single final MP4 behavior;
- local-first operation;
- current validation boundaries;
- backward compatibility for older runtime packages when supported by the existing engine.

Architecture work must not silently alter creative output.

---

## 25. Testing strategy

### Contract tests

Verify:

- Studio protocol schemas;
- package schemas;
- production/performance schemas;
- generated TS/Python contract parity.

### Engine unit tests

Verify:

- DAG resolution;
- artifact fingerprints;
- invalidation;
- project/revision/run behavior;
- structured errors/events.

### Integration tests

Verify:

- import ZIP → project revision;
- render request → pipeline execution;
- cancellation/retry;
- cache reuse;
- music-only invalidation;
- output registration.

### Runtime tests

Keep existing runtime version-specific test suites.

### Desktop E2E

At minimum:

```text
launch app
→ import known-good zodiac-job@4 ZIP
→ render
→ observe completed run
→ out/zodiac-story.mp4 exists
→ open-output action resolves correct path
```

No future editor feature should be required for this test.

---

## 26. Completion criteria for the first new Studio release

The architecture foundation is considered usable when:

1. Tauri/React Studio launches without importing Tkinter.
2. Python Studio Engine starts and reports protocol version.
3. User imports a valid `zodiac-job@4` ZIP.
4. Project/revision is persisted.
5. User starts a render.
6. UI receives typed progress/events.
7. Existing local pipeline performs required TTS/timing/runtime/render work.
8. Cache/invalidation behavior remains correct.
9. Render completes with exactly one public `out/zodiac-story.mp4`.
10. User can open the video/folder.
11. Failed runs are persisted and recoverable.
12. The same Engine can still be driven by a CLI adapter.
13. No Editor/Timeline implementation is required to meet this milestone.

---

## 27. Architecture acceptance criteria

Do not approve implementation that violates any of the following:

- frontend depends directly on legacy Python implementation classes;
- pipeline semantics are duplicated in TypeScript/Rust;
- Tauri owns business logic;
- file existence alone is the canonical cache-validity mechanism;
- new pipeline behavior requires editing a hard-coded UI step list;
- project and render run are treated as the same entity;
- protocol messages are unversioned;
- errors/progress are communicated only as raw text;
- preview requires a permanently separate visual implementation from Remotion;
- introducing a future `performance.compile` node would require redesigning the application architecture;
- adding the future Editor would require replacing the desktop shell again.

---

## 28. Decision summary

The refactor is intentionally asymmetrical:

**User-visible first release:**

```text
Import ZIP
→ Render
→ Open final video
```

**Underlying architecture:**

```text
Tauri + React
      ↓
Versioned Studio Protocol
      ↓
Python Studio Engine
      ├─ Project/Revision/Run domain
      ├─ Pipeline DAG
      ├─ Artifact Graph
      ├─ SQLite state
      ├─ Structured events/errors
      └─ worker/resource model
      ↓
Remotion runtime
      ↓
shared Render Core / future Performance Compiler
```

This architecture is the target foundation for Zodiac Studio, Editor migration, Performance Timeline and runtime 2.0. Feature exposure may remain intentionally small while the underlying boundaries are production-grade and extensible.
