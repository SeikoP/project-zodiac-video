# ChatGPT host runtime

Use the active phase manifest as the source of truth for required capabilities and fallback policy. This file maps those capabilities to available ChatGPT tools; it does not waive a capability, validator, receipt or approval.

| Manifest capability | ChatGPT provider | Rule |
| --- | --- | --- |
| exa_discovery | Exa connector mcp__Exa__web_search_exa | Tavily is the manifest-approved fallback when Exa is unavailable. |
| parallel_verify | Parallel Search connector mcp__Parallel_Search__web_search | Tavily, then built-in web search, are fallback routes only where the manifest allows them. |
| firecrawl_extract | Firecrawl connector mcp__Firecrawl__firecrawl_scrape | Conditional capability; block if unavailable. |
| vidiq_reference_analysis | vidIQ mcp__vidIQ__vidiq_watch_shortform_content | Conditional capability; block if unavailable. |
| viral_analysis | Installed ChatGPT viral-analysis plugin instructions | Guidance only; never treat as Zodiac evidence. |

Internal compilers, validators, phase gates, source hashes and approval receipts must run through the verified phase-scoped execution source. A tool result or skill read is evidence of invocation, not approval.

## Host delivery
- Publish the clean Phase-02 review surface as files or a reviewable artifact; only the user explicit review message approves it.
- Deliver the validated Job@5 ZIP as a file. ZIP readiness is not MP4 or media acceptance.
- Keep TTS, measured word timing, Remotion, captions, cover rasterization, audio and MP4 acceptance with the local runner.
