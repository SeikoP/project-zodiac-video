# Zodiac Job v4 Local Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make ChatGPT/plugin exports a thin creative handoff while Zodiac Studio owns runtime integrity, measured runtime validation, and final validation receipts.

**Architecture:** Add backward-compatible `zodiac-job@4` instead of changing v3 semantics. V4 packages pin runtime id/version only; Studio validates its bundled runtime locally, validates creative semantics from source data, performs TTS/timing/render, then writes the final runtime receipt. V2/v3 remain supported unchanged.

**Tech Stack:** Python 3.11, unittest, Tkinter, Remotion/Node shared runtime.

**Spec:** `docs/THIN_PACKAGE_V3_SPEC.md` plus the local-first boundary audit agreed on 2026-10-07.

## Global Constraints

- Preserve v2 and v3 compatibility.
- Keep production contract `2.0`.
- Keep exact runtime version resolution; never fall back to latest.
- Keep lineage and semantic animation validation in Studio.
- Keep interaction choreography as plugin authoring validation.
- V4 packages contain creative data only; no renderer/runtime state or plugin self-attested final receipt.
- Studio owns TTS, measured timing, renderer readiness, MP4/cover, final runtime validation and publish bundle.

## Review Focus

- Windows CRLF checkout must not change canonical runtime integrity hash.
- V3 packages must retain existing hash/receipt behavior.
- V4 import must work without VieNeu running.
- Invalid v4 lineage/mechanism/design/narration must still fail closed.
- FINAL_VALIDATION must only claim runtime PASS after local runtime outputs exist.

---

### Task 1: Add zodiac-job@4 local-first package contract
- Modify `tools/zodiac_local.py`.
- Modify `tests/test_zodiac_local.py`.
- Add v4 parsing, local runtime resolution, and direct creative/semantic validation without input FINAL_VALIDATION/handoff receipt.

### Task 2: Make runtime integrity portable
- Modify `tools/zodiac_local.py`.
- Create `.gitattributes`.
- Add LF/CRLF-equivalence regression test.

### Task 3: Move final validation receipt to local output
- Modify `tools/zodiac_local.py`, Studio pipeline tests.
- Write `out/FINAL_VALIDATION.json` at publish time and include it in the publish bundle.
- Exclude plugin receipt from v4 creative fingerprints.

### Task 4: Make VieNeu/environment polling non-blocking in Tk
- Modify `tools/studio/app.py` and tests.
- Run service/environment probes in background threads and update Tk state through the existing event queue.

### Task 5: Update plugin/export contracts
- Update zodiac-video-pipeline Handoff to emit v4 thin packages without runtime hash or FINAL_VALIDATION input.
- Update zodiac-package-exporter to accept v4 thin workspaces and stop requiring renderer/.

### Task 6: Verification
- Run Python unit suite and runtime tests through CI.
- Review branch diff, fix Critical/Important findings, then open PR without merging.
