# ChatGPT host runtime

## Plugin-owned orchestration and bounded source lookup

The plugin root pins XState 5.33.3, gpt-tokenizer 4.1.0 and TOON 4.4.0 in `package.json` and `package-lock.json`. They are plugin runtime dependencies, not session-global tools. From the verified plugin root, provision with `npm ci --ignore-scripts --no-audit --no-fund`; Node >=22.5 is required. For `resume-brief --context`, `gpt-tokenizer/encoding/o200k_base` is required. TOON is an optional lossless encoding with compact JSON fallback; XState has a built-in FSM fallback. A host without Node or the required tokenizer cannot claim context runtime availability. Never download dependencies merely to answer a context or source lookup query.

## Context delivery across phases and repairs

Use `node orchestration/resume-brief.mjs <workspace> --context` for normal task delivery. Plain resume remains a metadata-only diagnostic. The context route sends the revision-bound task, current policy, genuine receipt references, and selected exact guidance as one JSON envelope. Source-bound creative direction/scope/story spine survive phase changes; initial visual design also receives the approved narration and Narrative Plan. A scene task retains the complete selected scene and every beat/entity/event. Phase 03 receives source identities and review refs without importing research or creative brainstorming. Current user directions in the host remain authoritative; unpersisted instructions must not be inferred from an old summary.

`--token-budget 16000` is the default transport budget. Token measurements use `o200k_base` as an explicit proxy; they are not the total or hidden tokenizer usage of ChatGPT. JSON task data is encoded as TOON only when lossless decode equals the original and measured tokens are lower; text guidance is preserved exactly. JSON remains the canonical authoring format. There is no model inference or lossy semantic compression.

Pending required blocks have `FETCH_REQUIRED` and appear in `pending_references`. Fetch one with `--context --fetch-ref <selected-path>`; do not use its capability until its required guidance is held. An explicitly requested block, task, policy or complete scene can exceed budget and is never cut; `OVER_BUDGET_REQUIRED` is a delivery warning, not an approval or gate result. Accounting reports transport tokens before accounting fields; it excludes host history, messages, framing and external tool output. A small packet is not proof the entire task fits the host context.

Across steps/phases, reuse is opt-in: `--context --previous <caller-held-capsule.json> --reuse-id <its-id>`. Providing this pair asserts that the receiver still holds the actually delivered blocks from that capsule. Only matching workspace, policy, key and SHA-256 can produce `CALLER_HELD_IDENTICAL`; an undelivered block is never treated as held. Without acknowledgement, a new session receives full selected content within budget and explicit pending references. Never pass a prior capsule merely because its file exists after host context loss. Do not re-save a prose summary every step; stdout is the default and an existing caller cache is optional. This mechanism cannot erase the host's conversation history.

Phase 02 native execution records current canonical source hashes in its existing execution receipt. Context delivery includes only source-matching repair issues/groups and affected semantic nodes, with failed-step identities instead of entire stdout/stderr logs. Changed or older unbound receipts require a current check before repair. Exact input/compiler/output cache validation remains in force; semantic dirty metadata does not independently permit skipping a native validator. File fingerprinting uses bounded parallel reads without reusing stale in-process hashes. Independent preflight execution already uses the existing bounded runtime; no additional queue service or competing workflow state is introduced.

The existing bootstrap establishes verified phase-scoped source and capability availability; it is not a model runner. The existing Node runtime handles task routing, deterministic compilation, validators and cache. A separate LangGraph/model service is not required for these context improvements and is not installed.

XState computes one `next_task` from the existing pipeline state; it keeps no second persisted workflow state. `resume-brief.mjs <workspace>` includes the task ID, state/source revision hashes, allowed source paths, capability/gate requirements and a complete selected-scene context when a scene needs 4–5 distinct beats. Actual validators and user reviews remain authoritative. If a task ID is supplied, `write-phase02-authoring.mjs --workspace <workspace> --payload <intent.json> --task-id <id>` rejects stale tasks and changes outside the selected scene; older calls without task IDs remain compatible and retain existing validation. A task contract is not a filesystem sandbox.

Use `node orchestration/resume-brief.mjs <workspace> --query character_assembly` to inspect the manifest-derived phase/step/capability/source graph. This is a small in-memory workflow graph; it is not a replacement for a code index.

For unfamiliar implementation code, prefer exact-file reads, then scoped `rg -l -F` or `rg -n -F --max-count 20` against the owning source folder. Confirm `rg --version` before assuming ripgrep exists. If it is absent, use a scoped `git grep` in a repository checkout; otherwise fall back to bounded direct file reads. Restrict default searches to current executable source; do not scan old episode data, archives, node_modules, caches or full asset catalogs. Use the manifest-derived workflow graph for phase/step/capability relationships, and the existing semantic graph for scene/asset invalidation. Text matches are not a replacement for source-bound receipts or approval checks.

For baseline timing, run `node core/audit/benchmark-plugin-orchestration.mjs` from the skill root with the pinned runtime provisioned. This benchmark measures lookup and context source costs; it does not establish total ChatGPT latency or production acceptance.

Use the active phase manifest as the source of truth for required capabilities and fallback policy. This file maps those capabilities to available ChatGPT tools; it does not waive a capability, validator, receipt or approval.

| Manifest capability | ChatGPT provider | Rule |
| --- | --- | --- |
| exa_discovery | Exa connector mcp__Exa__web_search_exa | Tavily is the manifest-approved fallback when Exa is unavailable. |
| parallel_verify | Parallel Search connector mcp__Parallel_Search__web_search | Tavily, then built-in web search, are fallback routes only where the manifest allows them. |
| firecrawl_extract | Firecrawl connector mcp__Firecrawl__firecrawl_scrape | Conditional capability; block if unavailable. |
| vidiq_reference_analysis | vidIQ mcp__vidIQ__vidiq_watch_shortform_content | Conditional capability; block if unavailable. |
| viral_analysis | Installed ChatGPT viral-analysis plugin instructions | Guidance only; never treat as Zodiac evidence. |\n| humanizer_editor | Bundled Humanizer `skills://plugins/zodiac-video-pipeline/humanizer/skill.md` | Optional narration polish for observed natural-voice/formulaic-language/audience-fit weaknesses. Preserve semantics and evidence; never creates approval. |

Internal compilers, validators, phase gates, source hashes and approval receipts must run through the verified phase-scoped execution source. A tool result or skill read is evidence of invocation, not approval.

## Host delivery
- Publish the clean Phase-02 review surface as files or a reviewable artifact; only the user explicit review message approves it.
- Deliver the validated Job@5 ZIP as a file. ZIP readiness is not MP4 or media acceptance.
- Keep TTS, measured word timing, Remotion, captions, cover rasterization, audio and MP4 acceptance with the local runner.
