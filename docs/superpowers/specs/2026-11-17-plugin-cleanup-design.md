# Plugin cleanup scope and evidence

## Outcome

Keep creative Web Phase 1 and native Local Phases 2–3 consistent, reduce the guidance delivered for each task, and remove only code whose callers and distribution ownership are understood. The user's latest correction makes **Hình kể chuyện**, code `story_visual`, the sole active concept replacing both Narrative Visual and Story Text. Optional lettering belongs to the same entity/asset/state; there is no integration flag or dual-layer mode. Preserve approved source bytes, genuine reviews, native validation and Job@5 compatibility.

## Constraints

- Node >=22.5.0; use installed dependencies only.
- Web stays guidance-only and exports `zodiac-phase1-handoff@2`; it does not acquire a native runtime.
- Local continues accepting handoff v1 and v2; fresh Story Visual authoring requires an explicit use/omit decision.
- Hình kể chuyện (`story_visual`) is the sole active visual storytelling concept; optional lettering belongs to the same entity/asset/state.
- Remove Narrative Visual and Story Text from active prompts, guidance and schemas; old names remain only in explicit internal compatibility readers where required.
- Preserve source hashes, trust-boundary validation, explicit user approval and cache invalidation.
- Keep full draft guidance below 70000 bytes and design/scene guidance below 45000 bytes without removing required entry capabilities.
- Do not delete episode data, marketplace caches, historical handoffs or compatibility files based only on a text-search miss.
- Packaging and installed-cache changes are separate from source changes; no public release or MP4 acceptance is implied.

## Verified snapshot (2026-11-17)

The parent task started at main `d4349286`; concurrent visual integration can change HEAD and guidance sizes. Recheck before implementation. `docs/reviews/2026-11-17-capricorn-visual-validation.md` records 817 broad tests, 772 passes and 45 baseline failures; it explicitly separates technical validation from human/media acceptance. The corresponding `.runtime/reviews/capricorn-20261117/full-tests-final.log` remains the failure evidence, not a current-suite result.

### Exact mismatches

The visual-concept names below describe the audited baseline, not the desired active interface. The parent task owns the `story_visual` migration; this cleanup must verify the new interface rather than preserving old terminology or its mutual-exclusion rules.

1. `orchestration/tests/split-entrypoint-contract.test.mjs:11-14` demands native export/resume CLI names in the Web entry skill. The current Web skill forbids native runtime provisioning; `orchestration/phases/01-content.json` declares `execution_mode: creative_host` and five creative authoring steps. Test the current lightweight contract instead of restoring retired native instructions.
2. `orchestration/tests/phase02-execute.test.mjs` copies real `features/episode/episode-handoff.mjs` into an isolated source fixture but omits its `core/evidence/approval-source-hashes.mjs` import. The log at lines 1538–1574 shows `PRECOMPILE_SEAM_BLOCKED` and `Cannot find module` in a temporary fixture. Seven baseline cache/execution assertions stop before their intended checks; restore fixture closure before diagnosing production cache behavior.
3. Live read-only `loadStepContext('02-visual-production','visual_compile', flags, options)` measured full draft guidance at **72639 bytes**, design **36126**, scene **36932**, validation **25928**. Flags: affiliate=false, meme=false, mock_ad=true, retention=true, art_direction=true, relational=false; options: fresh/draft/canvas. The full-context <70000 test is a real size regression. Largest references: character catalog 10967, visual-intent contract 8437, selection guide 7154, assembly contract 5977 and direction index 4247 bytes. Work-unit scoping already works; prefer shortening duplicated prose over deleting required catalog entries or raising limits. These are file-byte sums, not total model token counts.
4. Split Local packaging selects all canonical `phases`, `features`, `references`, `compat`, etc. by root; it is not a reachability-minimal runtime. Therefore inclusion alone is not evidence that a module executes, and Web omission is not proof a canonical file is safe to delete.
5. Marketplace currently advertises Local only from `.runtime/plugin-dev/zodiac-video-local-unified`. Split Web/Local metadata is correct, but source changes do not update that copied installation. Reinstall only in a separately authorized deployment step, comparing bundle/cache hashes.
6. After restoring the fixture import, one hidden stale assertion surfaced: the coordinator test expects a sentinel file at `native-validator-scene_direction_validation.json` to survive. Current `parallel-native-preflight.mjs:12-19` legitimately writes the preflight receipt there, while native asset validation writes `native-assets-validator-scene_direction_validation.json`. Verify both executed PASS receipts and their distinct validator paths instead of preserving an obsolete sentinel.

### Active prompt cleanup found after the mechanical rename

The following are precise edits for the parent concept migration, not reasons for deleting arbitrary directories:

- `orchestration/phases/02-visual-production.md:17,52`: remove “Hình kể chuyện or chữ trong hình, never both” and “chữ trong hình in the same scene blocks.” Both statements contradict optional lettering inside the same Story Visual entity.
- `references/cover-composition-v2.md:32`: replace the remaining “Narrative-Visual” scale label with Story Visual.
- `orchestration/phases/01-content.md:42`, `references/narrative-motif.md:5`, `references/phase01-briefing.md:48`: remove old Visual Metaphor/Story Object creative vocabulary; explain semantic motif versus Phase-2 Story Visual geometry using current names only.
- `skills/zodiac-video-pipeline/SKILL.md`: canonical monolithic prompt still requires native Web source bootstrap/preflight/receipts, says Phase 1 has no user-facing ZIP, and mandates a fictional ad. Current Web is creative-host, exports a lightweight ZIP and makes parody optional. Replace obsolete sections with a minimal Web/Local owner router plus shared approval invariants. Deleting the entire file requires retiring the live monolithic builder/workflows first.
- `skills/zodiac-affiliate-commerce/SKILL.md`: routes to that monolithic prompt and assumes one fictional ad; preserve paused-commerce data checks, but route an optional ad request to the current owning phase instead. Both split profiles already omit this skill, so physical deletion does not reduce their always-loaded context.
- `references/contracts/authoring-ir-v1.schema.json:50`: old `story_object` is acceptable only if this is a documented internal legacy reader. Check its actual callers before retaining it; do not expose it through fresh authoring schemas.

### Candidate disposition and caller evidence

| Candidate | Disposition | Evidence and condition |
| --- | --- | --- |
| Unused `select_phase_files` import in `tools/release/build_split_plugin_bundle.py:10` | Remove | No use in the entire file; `build_profile(root, profile, destination)` uses its own Web allowlist and canonical-root selection. Preserve `tools/build_source_bundle.py`, which remains a live builder. |
| Duplicate writes of receipt wrapper, episode handoff/scope and composition/precompile fixtures in `phase02-execute.test.mjs:39-53` | Remove duplicates while repairing fixture | Same destination and bytes are written repeatedly. Keep one copy of every real module, all intended fake compiler behavior and all assertions. |
| Native CLI assertions in `split-entrypoint-contract.test.mjs:11-14` | Replace | Contradict current `creative_host` Web contract; retain phase ownership, real review, hash inventory and no-Phase-2 checks. |
| Old Narrative Visual/Story Text active guidance, manifests and schema fields | Replace with `story_visual` | Latest explicit user direction: one new concept, Hình kể chuyện. Remove old active references and choices together with their callers/tests; lettering is optional inside the same entity/asset/state. Keep internal `story_object` transport only if an explicit legacy reader requires it. |
| Full-context repeated explanations across `references/visual-direction.md`, `scene-direction.md`, `sticker-storytelling.md` and the new Story Visual guidance | Condense | Preserve actionable rules while removing obsolete two-concept choices and duplicate prose. Target >=2640 bytes saved from the measured snapshot, then remeasure after the unified concept migration. |
| `skills/humanizer` and `skills/zodiac-affiliate-commerce` | Defer physical deletion | Both split profiles disable humanizer. However `tools/release/build_plugin_bundle.py:18` and `tools/build_source_bundle.py:15-16` explicitly require these paths. No always-loaded savings from deleting files already absent from split packages. |
| Legacy monolithic `tools/release/build_plugin_bundle.py` | Keep for now | `.github/workflows/tests.yml:239-240` and `zodiac-plugin-release.yml:33` call it. Retiring it requires an intentional release migration, beyond this cleanup. |
| Entire `phases/phase01/` tree | Keep shared helpers; defer selective deletion | `features/episode/validate-episode-scope.mjs`, `validate-episode-concept.mjs`, `compile-writer-brief.mjs`, `core/evidence/compile-evidence-brief.mjs`, `orchestration/plan-plugin-use.mjs`, commerce validators import `phase01-artifacts.mjs`. `tools/build_source_bundle.py` explicitly selects execution-preflight/commit files. A whole-tree deletion breaks Local/import/release paths. |
| Shared `contracts/phase1-handoff.mjs`, performance and visual contracts | Keep validation; migrate active names | Web allowlist selects them; Local import and approval helpers call them. Rename/revise the active visual contract through the parent migration; isolate any necessary old names in compatibility readers. Supported plan versions 2.0/2.1 are reader compatibility while fresh Web authors 2.1. |
| `compat`, retired asset folders, commerce validators and v1 handoff import | Defer deletion | Existing import/recovery contracts and old workspaces may use them. First produce exact module + dynamic path + workflow + JSON-selection evidence per candidate; no blanket purge. |
| `.runtime`, `node_modules`, generated previews or installed caches | Out of scope | Not canonical clutter; active artifacts/dependencies must not be removed during this task. |

### Baseline failures are not one category

The five-step creative-host manifest explains stale tests that expect three native Phase-1 steps, executed validator receipts and old capability routes. Their replacements must prove approved handoff/import behavior rather than resurrect native Web execution. The missing fixture module and outdated entrypoint assertions above have direct causes. Context budget has a measured regression. Remaining names (release trigger policy, state validation, producer/runner ownership and receipt integrity) require individual reproduction; this audit does not claim all 45 are obsolete or resolved.

## Acceptance

Focused fixture and split-entrypoint tests pass with their meaningful assertions intact. Deterministic split-bundle and handoff/import checks pass. Context remains below the existing budgets with identical entry capability sets and review references available before use. Every deleted file has a recorded caller/selection check and no unresolved owner. Broad results are reported independently, including unresolved failures; no test is disabled simply to obtain green output.

## Execution evidence from this audit

- Before the narrow repairs: 18 focused tests, 10 PASS / 8 FAIL; seven coordinator cases were blocked by the missing temporary-source import.
- After import closure and Web-contract correction: 17 PASS / 1 FAIL; the remaining sentinel-receipt mismatch is described above and has a targeted test correction.
- Split bundle suite: `python -m pytest tests/test_split_plugin_bundle_builder.py -q` → 6 PASS after the mechanical concept rename.
- Handoff export/bootstrap suites → 15 PASS after the mechanical concept rename, including tamper, approval drift, missing visual decision, missing plan version and performance coverage failures.
- Final focused rerun: **18 PASS / 0 FAIL** (71.6 seconds), including cache reuse, tamper repair, dependency invalidation, distinct executed preflight/asset receipts and current Web/Local ownership.
- No broad suite, installation, episode mutation or rendered-media verification was performed by this audit worker. Parent work on the unified Story Visual contract continues separately.
