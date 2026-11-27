# Web Content Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Fix the defects found in the Zodiac Video Web 2.13.0 output for "Sư Tử – Khi thật lòng yêu" (long profile) so Web output is concept-faithful, evidenced and not defaulting to `story_visual: omitted`.

**Architecture:** Guidance-only changes in the Web-packaged references and `zodiac-video-web/SKILL.md`, locked by Python regression tests that read the built Web zip. No native runtime, Narrative Plan 2.1 and `zodiac-phase1-handoff@2` untouched.

**Tech Stack:** Markdown references, Python unittest (`tests/test_split_plugin_bundle_builder.py`), version 2.13.0 → 2.13.1.

**Spec:** the ChatGPT output pasted by the user (issues below).

## Global Constraints
- Web has no validators; every new check is a manual editorial check the writer shows in Content Review.
- Never invent approvals, receipts or `duration-exception.json`.
- Narrative Plan stays `2.1`; handoff stays `zodiac-phase1-handoff@2`.

## Issues found in the output
| # | Issue | Fix location |
|---|-------|--------------|
| 1 | Story Visual "omitted" with a generic reason ("đã đủ cụ thể") | story-visual-direction.md, narration-skeleton.md, SKILL |
| 2 | `narrative_motif` required by narrative-motif.md/phase01-briefing.md but forbidden by plan schema 2.1 (`additionalProperties:false`) | narrative-motif.md, phase01-briefing.md |
| 3 | Long-profile slots 2-4 read as dislikes; concept `love-sincere` (normal vs important person) only appears at paragraph 5 | narration-skeleton.md |
| 4 | Hook ("ba kiểu mất mặt… khó bỏ qua") does not carry the concept contrast nor cost the viewer | narration-skeleton.md |
| 5 | Content Review claims are bare assertions ("10/10 đúng giới hạn", "đã rà soát", "khác Bạch Dương và Nhân Mã") | narration-skeleton.md, SKILL |
| 6 | Audio-only review missed real defects: ambiguous "họ", fragment ordinals ("Thứ nhất, đem họ ra làm trò cười."), garbled line ("thử được người yêu bảo…") | narration-skeleton.md |
| 7 | Trend Phrase Pass "chủ động không sử dụng" with no record of whether research ran | narration-skeleton.md, SKILL |

### Task 1: Story Visual candidate review (issue 1)
**Files:** Modify `references/story-visual-direction.md`, `references/narration-skeleton.md`, `skills/zodiac-video-web/SKILL.md`, `orchestration/phases/01-content.md`; Test `tests/test_split_plugin_bundle_builder.py`.
- [ ] Failing test `test_web_story_visual_requires_candidate_review`: packaged SKILL and `story-visual-direction.md` contain "Story Visual candidate review", "at least two candidates", "which condition failed".
- [ ] Add the rule: before `omitted`, name ≥2 candidate story points (paragraph, fact, visible subject+action), score the five editorial-test conditions per candidate, and `omitted` is valid only with the failed condition per candidate; "already concrete" alone is not a reason. For a long profile the Turn paragraph and one contrast paragraph must be among candidates.
- [ ] Run test → PASS.

### Task 2: Motif carrier conflict (issue 2)
**Files:** Modify `references/narrative-motif.md`, `references/phase01-briefing.md`; Test same file.
- [ ] Failing test: packaged `narrative-motif.md` states that Plan 2.1 must not contain `narrative_motif` and names `motif_candidates` in the Writer Brief as the carrier.
- [ ] Rewrite the Narrative Design contract: the object is the working shape; for Plan 2.1 write it into Writer Brief `motif_candidates` (one string: label, setup→friction→turn→payoff, callback, beat ids, removal test); legacy plans without `additionalProperties:false` are not an exception for fresh runs.
- [ ] PASS.

### Task 3: Concept fit and hook (issues 3, 4)
**Files:** Modify `references/narration-skeleton.md`, Web SKILL; Test same file.
- [ ] Failing test: packaged skeleton contains "Concept fit" and "Hook carries the concept".
- [ ] Add: slots 2-4 keep "Thứ nhất/hai/ba" but their job follows the concept: dislikes/warnings for `dealbreaker` concepts; for concepts whose thesis contrasts two audiences (e.g. `love-sincere`, normal vs important person) each of 2-4 must already show that contrast; hook must name the concept's contrast or what the viewer risks; check by deleting the sign name and the concept id from the hook and asking whether the concept is still visible.
- [ ] PASS.

### Task 4: Evidence in Content Review (issues 5, 6, 7)
**Files:** Modify `references/narration-skeleton.md`, Web SKILL; Test same file.
- [ ] Failing test: packaged skeleton contains "Per-paragraph token table", "Sign-swap test names the swap sign", "referent", "Trend search status".
- [ ] Add to the manual check: token table per paragraph vs limits; sign-swap names the swapped sign and quotes the line that breaks; audio-only review lists checked items and any fixed referent/fragment/garbled line, empty list needs the words "none found after reading each paragraph"; Trend Phrase Pass records `searched: yes/no`, query function and result, never "không dùng" alone.
- [ ] PASS.

### Task 5: Version, build, verify, push
- [ ] Bump 2.13.0 → 2.13.1 in `plugin.json`, `.codex-plugin/plugin.json`, `pipeline-state.template.json`.
- [ ] Run `python -m pytest tests/test_split_plugin_bundle_builder.py tests/test_web_local_handoff_contract.py tests/test_plugin_bundle_builder.py -q` and `node --test orchestration/tests/*.test.mjs`.
- [ ] Commit, `git fetch`, push `main`, then shut the machine down.

## Review Focus
- Web zip must still contain every reference the narration step loads (existing test).
- `narrative_motif` must not reappear as a Plan 2.1 field (Task 2 test).
- Context budget of the narration step (<50000 bytes) must still hold after added text.

## Self-review
Coverage: all 7 issues map to a task. Tasks 1-4 edit the same files, so they are one commit. Proportion: guidance edits only, no code beyond tests.
