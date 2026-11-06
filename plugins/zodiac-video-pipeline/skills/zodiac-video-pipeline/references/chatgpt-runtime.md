# ChatGPT host runtime

## Plugin-owned orchestration and code intelligence

The plugin root includes a pinned `package.json` and `package-lock.json` for XState 5.33.3, CodeGraph 1.6.2, gpt-tokenizer 4.1.0 and TOON 4.4.0. These are plugin runtime dependencies, not a dependency on the developer's current Codex/MCP session. From the verified plugin root, provision with `npm ci --ignore-scripts --no-audit --no-fund`; Node >=22.5 is required. A host without Node/package installation is unavailable for this runtime; do not claim that an installed ChatGPT skill automatically supplies an execution environment or installs packages. Never download dependencies while answering a context or graph query.

## Context delivery across phases and repairs

Use `node orchestration/resume-brief.mjs <workspace> --context` for normal task delivery. Plain resume remains a metadata-only diagnostic. The context route sends the revision-bound task, current policy, genuine receipt references, and selected exact guidance as one JSON envelope. Source-bound creative direction/scope/story spine survive phase changes; initial visual design also receives the approved narration and Narrative Plan. A scene task retains the complete selected scene and every beat/entity/event. Phase 03 receives source identities and review refs without importing research or creative brainstorming. Current user directions in the host remain authoritative; unpersisted instructions must not be inferred from an old summary.

`--token-budget 16000` is the default transport budget. Token measurements use `o200k_base` as an explicit proxy; they are not the total or hidden tokenizer usage of ChatGPT. JSON task data is encoded as TOON only when lossless decode equals the original and measured tokens are lower; text guidance is preserved exactly. JSON remains the canonical authoring format. There is no model inference or lossy semantic compression.

Pending required blocks have `FETCH_REQUIRED` and appear in `pending_references`. Fetch one with `--context --fetch-ref <selected-path>`; do not use its capability until its required guidance is held. An explicitly requested block, task, policy or complete scene can exceed budget and is never cut; `OVER_BUDGET_REQUIRED` is a delivery warning, not an approval or gate result. Accounting reports transport tokens before accounting fields; it excludes host history, messages, framing and external tool output. A small packet is not proof the entire task fits the host context.

Across steps/phases, reuse is opt-in: `--context --previous <caller-held-capsule.json> --reuse-id <its-id>`. Providing this pair asserts that the receiver still holds the actually delivered blocks from that capsule. Only matching workspace, policy, key and SHA-256 can produce `CALLER_HELD_IDENTICAL`; an undelivered block is never treated as held. Without acknowledgement, a new session receives full selected content within budget and explicit pending references. Never pass a prior capsule merely because its file exists after host context loss. Do not re-save a prose summary every step; stdout is the default and an existing caller cache is optional. This mechanism cannot erase the host's conversation history.

Phase 02 native execution records current canonical source hashes in its existing execution receipt. Context delivery includes only source-matching repair issues/groups and affected semantic nodes, with failed-step identities instead of entire stdout/stderr logs. Changed or older unbound receipts require a current check before repair. Exact input/compiler/output cache validation remains in force; semantic dirty metadata does not independently permit skipping a native validator. File fingerprinting uses bounded parallel reads without reusing stale in-process hashes. Independent preflight execution already uses the existing bounded runtime; no additional queue service or competing workflow state is introduced.

The existing bootstrap establishes verified phase-scoped source and capability availability; it is not a model runner. The existing Node runtime handles task routing, deterministic compilation, validators and cache. A separate LangGraph/model service is not required for these context improvements and is not installed.

XState computes one `next_task` from the existing pipeline state; it keeps no second persisted workflow state. `resume-brief.mjs <workspace>` includes the task ID, state/source revision hashes, allowed source paths, capability/gate requirements and a complete selected-scene context when a scene needs 4–5 distinct beats. Actual validators and user reviews remain authoritative. If a task ID is supplied, `write-phase02-authoring.mjs --workspace <workspace> --payload <intent.json> --task-id <id>` rejects stale tasks and changes outside the selected scene; older calls without task IDs remain compatible and retain existing validation. A task contract is not a filesystem sandbox.

Use `node orchestration/resume-brief.mjs <workspace> --query character_assembly` to inspect the manifest-derived phase/step/capability/source graph. This is a small in-memory workflow graph; it is not a replacement for a code index.

For actual code intelligence, from the skill root run:

```sh
node --liftoff-only core/workflow/runtime-codegraph.mjs index
node core/workflow/runtime-codegraph.mjs query resolveNextTask
```

This invokes the CodeGraph SDK installed inside this plugin. It mirrors only current executable modules reachable from manifest tool locators and coordinator imports into the plugin's ignored `.runtime/codegraph/` cache, then indexes real symbols/calls/imports in SQLite. It does not index the entire repository, episode inputs, chat history, retired creative examples or secrets. Query results carry original-source hashes; changed source/cache is rejected until rebuilt. Source is returned for matching symbols, with bounded neighboring symbol metadata/relations; omitted symbols are explicit. CodeGraph does not grant approval, select creative evidence or execute the workflow.

CodeGraph is loaded only when explicitly requested, not during ordinary task routing. Its platform bundle and index have a material disk/startup cost. Do not package development `node_modules/` or cached databases as episode artifacts; install the pinned dependency for the target OS. To reproduce local measurements, run `node --liftoff-only core/audit/benchmark-plugin-orchestration.mjs` from the skill root. This measures real installed SDKs/source plus a labeled synthetic 12-scene fixture; it makes no claim about ChatGPT latency or production acceptance.

Use the active phase manifest as the source of truth for required capabilities and fallback policy. This file maps those capabilities to available ChatGPT tools; it does not waive a capability, validator, receipt or approval.

| Manifest capability | ChatGPT provider | Rule |
| --- | --- | --- |
| exa_discovery | Exa connector mcp__Exa__web_search_exa | Tavily is the manifest-approved fallback when Exa is unavailable. |
| parallel_verify | Parallel Search connector mcp__Parallel_Search__web_search | Tavily, then built-in web search, are fallback routes only where the manifest allows them. |
| firecrawl_extract | Firecrawl connector mcp__Firecrawl__firecrawl_scrape | Conditional capability; block if unavailable. |
| vidiq_reference_analysis | vidIQ mcp__vidIQ__vidiq_watch_shortform_content | Conditional capability; block if unavailable. |
| viral_analysis | Installed ChatGPT viral-analysis plugin instructions | Guidance only; never treat as Zodiac evidence. |\n| humanwriting_editor | HumanWriting `skills://plugins/humanwriting/human-writing/skill.md` | Optional narration polish for observed natural-voice/formulaic-language/audience-fit weaknesses. Preserve semantics and evidence; never creates approval. |\n| notion_knowledge_sync | Notion knowledge-capture workflow | Optional one-way sync of status, artifact hashes/links, validated decisions and blockers after Zodiac state is written. Notion never creates episode evidence, review approval or pipeline authority. |

Internal compilers, validators, phase gates, source hashes and approval receipts must run through the verified phase-scoped execution source. A tool result or skill read is evidence of invocation, not approval.

## Host delivery
- Publish the clean Phase-02 review surface as files or a reviewable artifact; only the user explicit review message approves it.
- Deliver the validated Job@5 ZIP as a file. ZIP readiness is not MP4 or media acceptance.
- Keep TTS, measured word timing, Remotion, captions, cover rasterization, audio and MP4 acceptance with the local runner.
