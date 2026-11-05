# Context isolation contract

## Fresh by default
Fresh invocation input set:
1. current user request;
2. current-turn attachments that are not recognized as raw series trackers and are not revoked;
3. canonical non-creative plugin contracts;
4. research explicitly run for the current request;
5. optional minimized `series_selection` compiled from a valid tracker.

Excluded unless explicitly requested:
- account/personal memory;
- prior chats;
- prior Zodiac concepts/scripts beyond short anti-duplication summaries in `series_selection`;
- old packages/drafts;
- continuity snapshots;
- sign-specific examples;
- reference-video example content;
- raw `series_tracker_raw` content in creative steps;
- any user-revoked, deleted, discarded, replaced or explicitly excluded source.

## Revoked-source rule
User authorization outranks physical availability. If the user says a file, package, draft, attachment, prior result or source should be deleted, forgotten, discarded, replaced or no longer used, classify it as revoked context immediately.

A revoked source stays forbidden even when:
- the runtime remounts it into `/mnt/data`;
- a Project/file surface lists it again;
- an earlier chat still contains it;
- a connector/tool can retrieve it;
- a path or attachment ID remains valid;
- the same bytes are available under a stale generated copy.

Do not open or read a revoked source to "check" whether it is the same file. Do not use its content, metadata, filename, hashes or derived artifacts as creative or execution input. It becomes eligible again only if the user explicitly re-attaches or re-authorizes that exact source. A later official plugin/source named by the user supersedes conflicting retired material.

## Series tracker exception
A `zodiac-series-checklist@1` tracker is a completion ledger, not creative continuity. Its presence does not switch `run_mode` to continuity and does not disable fresh Exa/Parallel research. The router compiles only minimal status/history into `.authoring/series-selection.json`; raw tracker content is then excluded from Content/Visual creative context.

## Continuity opt-in
Prior project content may be retrieved only when the current user turn explicitly asks to continue/reuse/resume/restore/compare or points to a prior creative artifact/conversation/series beyond the tracker ledger.

Retrieve the minimum relevant context. Do not broaden a continuity request into unrelated remembered preferences or old concepts. Continuity opt-in never overrides an explicit source revocation unless the user clearly re-authorizes that source.

## Reference mechanics vs creative content
Reference transcripts/examples may teach cadence, narrator stance, interaction rhythm, contrast/reversal mechanics. They do not provide Zodiac evidence, sign selection, claims, jokes, situations, progression, or reusable wording.

This separation is mandatory to prevent example anchoring.
