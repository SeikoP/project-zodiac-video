# Conditional Viral Analysis routing — v2.2.17

## Default
`flags.viral_support_needed=false`. Do **not** call the external Viral Analysis plugin just because it is installed, was used in a previous video, or is mentioned in legacy writer examples. The 3-phase router remains unchanged. Evaluate the flag before the `concept` step and preserve the decision in state. Do not turn it on late merely to satisfy a missing receipt.

## Use the external plugin when useful
Set `true` when the user explicitly requests Viral review/testing for the active content, supplies a competing reference to dissect, asks to compare hooks or story formats, or an initial editorial review identifies a concrete unresolved hook/progression/payoff problem for which a QS→PT→ĐK / A/B hypothesis would change the narrative plan. Record a one-line reason in the concept step operation/decision notes before the external call. Do not assert algorithmic uplift or measured retention without campaign/video data.

## Keep it off otherwise
Set `false` for straightforward factual verification, continuation of approved narration, native preview, asset compilation, caption/layout fixes, rendering, packaging and checkpoint recovery. If a ready/approved story already contains existing V1–V3 mechanics, preserve their exact lineage rather than reanalyzing. Never recreate old narrative from unrelated memory.

## Contract and proofs
`01-content.json` gates the existing `viral_analysis` guidance skill through `when: flag:viral_support_needed`. The existing required `viral-analysis.json` remains a small *editorial concept-mechanics artifact* in all runs because current Content Engine v2 and `validate-content-contract.mjs` expect it; in the no-plugin path, label its origin `editorial_local`, not `external_plugin`. Existing records may omit this new optional provenance field for backwards compatibility. In a plugin-assisted path, label `origin: plugin_guidance` and require an authentic `skill_read`/`plugin_result` receipt and `application_summary`. Every mechanic must still map to concept changes and a `writer_effect` and match the writer brief; never fill it with generic promises of virality.

Keep `required_outputs`, `viral_application` quality gate and the rest of Content validation in place. The absence of a Viral plugin invocation is not a waiver of Content Review or user approval. The flag belongs to the current run; no new phase or sub-agent. Re-validate state after changing flags before stepping forward.

If no transferable mechanic improves this premise, keep the required artifact with mechanics: [] and decision.mode: omitted plus a substantive reason; writer effects remain empty. The external flag stays conditional.
