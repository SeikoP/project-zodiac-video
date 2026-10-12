# Zodiac maintainability refactor — design

Status: DESIGN REVIEW  
Baseline: `main@3fe89c2`, plugin `2.4.62`  
Scope: zodiac plugin/control plane, asset framework, local runner/runtime, contracts/tests required by those boundaries.

## 1. Intent

Refactor the current Zodiac production stack so it is easier to maintain, safer to extend, and cheaper in context/code surface while preserving the working producer/runner contract.

The project already has the right top-level separation (`plugins/`, `contracts/`, `runtime/`, `tools/`, `tests/`), so this change does **not** reorganize the whole repository. It targets the internal boundaries that have accumulated compatibility and release history.

Success means:

- new plugin features can be added without extending a release-history prompt or adding another ad-hoc orchestration path;
- fresh Phase 2 loads only the modules/assets selected for the current job;
- asset variety grows through composable registries/capabilities rather than large batches of finished SVGs;
- the local app has one current runner/application path and a bounded legacy adapter;
- runtime source has one current implementation per runtime family, with historical versions resolved through release metadata rather than copied source trees;
- public producer/runner contracts remain stable and independently testable.

## 2. Constraints

The refactor must preserve these boundaries:

1. `zodiac-job@5` remains the Phase 3 producer/runner handoff.
2. Plugin owns content/visual authoring and structural validation.
3. Local runner owns measured TTS, timing, audio, Remotion, MP4 and media QA.
4. Structural PASS never implies creative/visual/audio PASS.
5. Existing approved episode bytes and approvals are not silently rewritten.
6. Scene-set, Story Object, props, effects and character identity remain distinct concepts.
7. Compatibility assets/runtime support are not physically deleted until reverse-dependency and compatibility gates prove deletion safe.
8. Fresh paths must not auto-load compatibility-only room/environment cues.
9. No Job@5 or renderer schema migration is required for this refactor.

## 3. Current architectural pressure

The baseline has three main maintainability problems.

### 3.1 Plugin policy/control-plane growth

The plugin contains hundreds of files, with orchestration itself carrying a large share of the code and tests. The active plugin prompt has accumulated release-specific guidance instead of resolving one current effective policy.

Symptoms:

- policy history appears in active instructions;
- compile/validate/review/release/migration scripts live at the same orchestration level;
- compatibility paths are present near fresh-path logic;
- adding one capability tends to add another script, validator and prompt clause.

### 3.2 Asset framework is more mature than asset coverage

V4 has a useful taxonomy and a strong character assembly model, but fresh scene coverage is narrow. Character variation is already reasonably rich while scene-set/effect/contact coverage is comparatively thin.

The next asset investment should therefore improve **visual language coverage**, not multiply complete character SVGs.

### 3.3 Runner is hybrid

The local application currently combines legacy and Job@5/v2 paths in the same shell. Large modules such as `tools/zodiac_local.py` own many unrelated responsibilities, and multiple full runtime versions coexist in the repository.

This makes fixes prone to version/path mismatch and causes GUI code to understand too much pipeline detail.

## 4. Target architecture

### 4.1 Plugin

The plugin becomes a small routing layer over explicit modules:

```text
zodiac-video-pipeline/
├─ SKILL.md
├─ bootstrap/
│  ├─ current-policy.json
│  ├─ current-release.json
│  └─ context-router.json
├─ core/
│  ├─ state/
│  ├─ evidence/
│  ├─ approval/
│  ├─ lineage/
│  ├─ receipts/
│  └─ schema/
├─ phases/
│  ├─ phase01/
│  ├─ phase02/
│  └─ phase03/
├─ features/
│  ├─ story-object/
│  ├─ cover/
│  ├─ narration-performance/
│  ├─ episode-formats/
│  └─ memes/
├─ assets/
│  └─ v4/
├─ compat/
│  ├─ migrations/
│  ├─ old-environment/
│  └─ legacy-job/
└─ cli/
```

The exact physical move may be incremental; the dependency direction is the invariant:

```text
bootstrap → phases → core/features → asset compilers → Job@5
                         ↑
                 compat only when selected
```

Fresh code must not depend on compatibility modules by default.

### 4.2 Effective policy instead of release-history prompt

Active plugin instructions should state stable invariants and load one current effective policy.

Example:

```json
{
  "narrative": "2.1",
  "story_object": "v2",
  "visual_grammar": "v4",
  "scene_system": "scene-set@1",
  "character_assembly": "v2",
  "handoff": "zodiac-job@5",
  "renderer": "zodiac-renderer@2.0.1"
}
```

Historical release notes remain documentation/provenance, not active prompt rules.

### 4.3 Capability registry

Compilers and validators are exposed through capabilities rather than phase code knowing individual script names.

Example:

```json
{
  "scene_set": {
    "compile": "assets/scene-set/compile.mjs",
    "validators": ["identity", "geometry", "accents"]
  },
  "story_object": {
    "compile": "features/story-object/compile.mjs",
    "validators": ["semantic", "composition", "progression"]
  }
}
```

Existing script paths may remain as wrappers during migration.

### 4.4 Contracts

The repository root is the canonical contract source.

```text
contracts/
├─ public/
├─ plugin/
└─ assets/
```

Plugin packages receive a generated/vendor contract bundle with hashes. A schema maintained in the root must not be manually duplicated and independently edited inside the plugin.

### 4.5 Asset model

Assets stay composable:

```text
scene-set
+ optional scene accents
+ character assembly
+ physical props
+ story object
+ semantic effects
+ scene direction
```

Selection becomes metadata/capability driven. Assets declare role, status, tags, compatibility and supported composition capabilities.

The selection engine answers a narrative need with a capability, then resolves registered assets. Missing support is reported as a missing capability rather than triggering uncontrolled SVG generation.

### 4.6 Runner/application

The GUI calls one application service instead of directly understanding legacy/v2 controllers.

```text
Qt UI
  ↓
ApplicationService
  ↓
Runner pipeline
  ├─ package
  ├─ voice
  ├─ timing
  ├─ plan
  ├─ render
  ├─ audio
  └─ output
       ↑
legacy adapter only when package requires it
```

Current Job@5/v2 becomes the primary path. Legacy is isolated behind an adapter.

Large legacy utilities are split by ownership while preserving public entrypoints as wrappers until callers migrate.

### 4.7 Runtime source/versioning

Target:

```text
runtime/
├─ source/
│  ├─ zodiac-renderer/
│  └─ zodiac-remotion-legacy/
├─ releases/
│  ├─ zodiac-renderer.json
│  └─ zodiac-remotion.json
└─ fixtures/
```

Release metadata records current/supported versions and immutable hashes. Historical complete source trees move out of the active source path only after all consumers resolve through the runtime registry and compatibility tests prove safe.

## 5. Asset expansion strategy

The first expansion wave focuses on under-covered visual capabilities.

### Scene-set families

Keep:

- home
- cafe

Add candidates:

- school/classroom
- study/work
- outdoor/street
- neutral/minimal

These are stable stages, not full narrative backgrounds. Characters and Story Objects remain the primary story carriers.

### Scene accents

Add small, optional context pieces such as:

- board/poster
- shelf
- clock
- menu/sign
- school/study décor

Accents must stay within the authored scene-set wall region and never become automatic defaults.

### Effects

Expand semantic effect families for:

- surprise
- pressure
- confusion
- embarrassment
- tension
- emphasis
- reaction/motion marks

Effects must have lifecycle semantics, not just decorative SVG selection.

### Contact/action coverage

Prefer capability coverage over asset count:

- give/pass object
- hold/show object
- write/read
- phone/text
- sit/lean/contact with furniture
- compare/point/react between 2–3 actors

New character SVG states are compiled only when an authored action actually requires them.

### Story Object

Do not build a fixed “one object per zodiac sign” library. Story Objects remain episode-authored semantic mechanisms with removal-test/progression/relation requirements.

## 6. Migration phases

The work is intentionally grouped into five substantial phases.

### Phase A — Plugin/control-plane consolidation

Goals:

- replace release-history active prompt with effective policy;
- introduce capability registry and stable module boundaries;
- separate fresh-path modules from compatibility modules;
- keep legacy script names as forwarding wrappers where required;
- reduce Phase 2 context loading to selected modules and current policy.

Exit criteria:

- existing fresh Phase 1→2→3 structural tests pass;
- old entrypoints used by retained tests/workspaces still resolve;
- no fresh selected context requires compatibility guidance unless explicitly selected;
- plugin release/readback can be produced from one verified source commit.

### Phase B — Asset system and coverage expansion

Goals:

- metadata-driven asset registry/selection;
- capability coverage matrix;
- add scene-set/effect/contact wave 1;
- preserve Character Assembly and current style tokens;
- keep compatibility assets resolvable but out of fresh defaults.

Exit criteria:

- a clean fresh fixture can select each new scene family without loading legacy room profiles;
- 1-, 2- and 3-character compositions have supported layout/contact paths;
- effect lifecycle and accent bounds are structurally validated;
- asset selection/materialization includes only selected dependencies;
- no generate-many-then-dedupe workflow is introduced.

### Phase C — Runner unification

Goals:

- establish one ApplicationService/current pipeline;
- make Job@5/v2 primary;
- isolate legacy behavior behind an adapter;
- split `zodiac_local.py` responsibilities into runner services while retaining compatibility wrappers;
- stop GUI code from directly coordinating two controller families.

Exit criteria:

- current Job@5 import through OUTPUT uses the unified service;
- legacy fixture still opens/runs through the adapter;
- invalidation/cache semantics remain equivalent;
- GUI no longer owns legacy/v2 pipeline branching beyond an explicit compatibility status.

### Phase D — Runtime and contract consolidation

Goals:

- add runtime registry/resolver;
- use one current source per runtime family;
- canonicalize public/plugin/asset contract ownership;
- generate plugin contract bundle from root sources;
- only then archive/prune duplicate runtime source versions that have no active consumers.

Exit criteria:

- package pins select runtime through registry, not hard-coded directory assumptions;
- current supported versions pass renderer/import tests;
- contract hash/parity tests prove generated plugin copies match source;
- reverse-dependency audit proves every source tree selected for removal is unreferenced by supported paths.

### Phase E — Test/CI consolidation and cleanup

Goals:

- split monolithic tests by package/voice/timing/plan/render/audio/output/compatibility;
- split plugin tests by core/phases/assets/compatibility/release;
- create CI tiers: smoke → unit → contract → integration → compatibility → release;
- remove superseded wrappers/history only after their deprecation gates expire;
- update architecture docs to one current source of truth and move superseded guidance to historical index.

Exit criteria:

- fast PR suite covers current paths without running unnecessary historical suites;
- compatibility suite remains explicit and independently runnable;
- no test relies on a stale runtime default;
- no active documentation points to retired entrypoints;
- repository dependency audit is clean for deleted compatibility/runtime material.

## 7. Error and compatibility policy

- Unknown current capability: fail closed with a structured capability-missing error.
- Unknown legacy package/runtime version: compatibility adapter rejects it unless registered.
- Registry entry exists but bytes/hash mismatch: fail closed.
- Generated contract bundle differs from canonical source: release gate fails.
- Asset absent from selected dependency graph: do not stage it.
- Human creative/media review remains separate from structural validators.

## 8. Testing strategy

Every implementation phase uses TDD for behavior changes.

Required layers:

1. unit tests for new registries/resolvers/services;
2. parity tests around old wrappers versus new implementation;
3. golden Job@5 import/export fixtures;
4. fresh Phase 2 selected-context/asset compilation fixtures;
5. legacy compatibility fixtures;
6. renderer structural/smoke tests;
7. release consistency/readback checks.

Actual audio/prosody/pixel/MP4 approval remains an explicit local acceptance step and is never inferred from unit/CI success.

## 9. Non-goals

This refactor does not:

- replace Remotion;
- redesign Job@5;
- merge plugin and runner ownership;
- change approved narration/creative decisions;
- create a new all-purpose framework;
- delete all historical assets immediately;
- introduce mandatory background complexity;
- increase asset quotas.

## 10. Implementation ordering

The five phases execute in this order:

```text
A Plugin/control plane
→ B Asset system/coverage
→ C Runner unification
→ D Runtime/contracts
→ E Test/CI cleanup
```

Phase C may prepare extraction helpers while Phase B is in progress, but no cross-phase cutover occurs before the preceding phase's compatibility gate is green.

The reason for Plugin-first is to stop adding new asset capability onto a control plane that is already too broad. Asset expansion follows on the new registry boundary. Runner/runtime consolidation then consumes stable producer contracts rather than changing simultaneously with them.

## 11. Review focus

During implementation review, specifically look for:

- compatibility imports leaking back into fresh paths;
- forwarding wrappers that accidentally become a second implementation;
- asset registry metadata that duplicates logic rather than describing capability;
- GUI code that still branches deeply on legacy/current pipeline details;
- runtime version defaults outside the registry;
- schema copies that can drift from root contracts;
- tests that claim creative/media PASS from structural evidence;
- “cleanup” that deletes referenced historical bytes prematurely.
