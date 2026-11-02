# Running this plugin on Claude

The ChatGPT edition (`plugin.json`, `extensions."com.openai"`) is unchanged. On Claude the skill folder is on disk and Node runs from it, so no phase-scoped source bundle is needed: run the orchestration scripts from this skill root. Everything else (router, manifests, gates, receipts, approvals) is identical.

## Phase 01 capability equivalents
| Manifest capability | ChatGPT tool | On Claude |
| --- | --- | --- |
| `exa_discovery` | Exa `web_search_exa` | Exa connector if connected, otherwise `WebSearch` |
| `parallel_verify` | Parallel Search `web_search` | Parallel Search connector if connected, otherwise `WebSearch` with a second independent query |
| `firecrawl_extract` | Firecrawl `firecrawl_scrape` | Firecrawl connector if connected, otherwise `WebFetch` |
| `vidiq_reference_analysis` | vidIQ short-form analysis | vidIQ connector. A `block` capability: if it is not connected, stop and ask; do not substitute |
| `viral_analysis` (guidance skill) | ChatGPT plugin instructions | Social Media Skills plugin (`viral-reverse-engineering`, `hook-writer`, `short-form-video-script`) as guidance only. Block if unavailable |

Capabilities marked `fallback` may use the substitute; capabilities marked `block` may not. The manifest's `unavailable_policy` still governs.

## `skills://plugins/...` references
Some manifest entries point at ChatGPT-installed plugins by URI, for example the `evidence` step's `skills://plugins/app-.../Search` (search guidance) and the `concept` step's `viral_analysis` skill. These do not resolve on Claude and `plan-step-context.mjs` reports them as non-files. Do not treat that as a missing source. Use the table above: the connector or search tool does the work, and the Social Media Skills plugin supplies viral-analysis guidance. A `block` capability still blocks if its replacement is unavailable.

## Model per task (optional subagents in `agents/`)
Use the cheapest model that the step's validators can still catch mistakes for; spend the strongest model where quality is the deliverable.
| Task | Agent | Model | Why |
| --- | --- | --- | --- |
| Evidence gathering | `zodiac-researcher` | sonnet | Search volume, sources are checkable |
| Concept and narration | `zodiac-story-writer` | opus | The story is the product; reviewed by the user |
| Visual authoring | `zodiac-visual-author` | sonnet | Structured inputs; native compilers and validators judge them |
| Validators, commits, gates, export | `zodiac-gatekeeper` | haiku | Mechanical, no judgment |
| Pre-review second opinion | `zodiac-reviewer` | opus | Independent check before the user's review |

Spawn an agent only when the work is large enough to justify a cold start. Agents never approve, never write receipts by hand, and never replace the user's Content or Visual Review.

## Tool mapping
- Review surface from `prepare-phase02-review.mjs`: publish as an Artifact or send the files; approval is still the user's own chat message bound to source hashes.
- Job@5 ZIP: deliver with `SendUserFile`.
- Step progress: the task list.
