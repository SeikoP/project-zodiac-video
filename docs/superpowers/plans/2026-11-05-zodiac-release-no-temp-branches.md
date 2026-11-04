# Zodiac Release Workflow Without Temporary Branches Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Remove release-branch noise by running Zodiac archive/bundle workflows from authoritative main commits.

**Architecture:** Keep existing workflows but make main the normal trigger. Plugin archive runs when version-bearing plugin files change. Bundle workflow runs when the installed-plugin release record changes and expands to all three phases through a matrix; manual dispatch remains phase-selective.

**Tech Stack:** GitHub Actions YAML, Node.js static regression tests.

**Spec:** docs/superpowers/designs/2026-11-05-zodiac-release-no-temp-branches.md

## Global Constraints
- Do not remove workflow_dispatch.
- Future normal releases must not require a release/* branch.
- Main-triggered bundle release must produce 01-content, 02-visual-production and 03-handoff.
- Manual bundle dispatch must remain able to select one phase.
- Existing release artifacts and installed plugin releases remain untouched.

## Review Focus
- Version bump touching only one of the three version-bearing files still triggers archive.
- Release-record merge triggers exactly the three phase bundle variants.
- Ordinary source changes do not trigger release archive/bundle workflows.
- Manual dispatch behavior is preserved.
- Cleanup does not rewrite main or remove published artifacts.

---

### Task 1: Regression contract for workflow triggers
- [x] Add a static test that fails while workflows are dispatch-only.
- [x] Assert plugin archive has main/path push trigger.
- [x] Assert source bundle has main/release-record push trigger and all-phase matrix.
- [x] Run the targeted Node test and observe RED.

### Task 2: Main-native release workflows
- [x] Update zodiac-plugin-release.yml with main/path trigger.
- [x] Update zodiac-source-bundle.yml with main/release-record trigger.
- [x] Use event-aware matrix: one manual phase vs all three push phases.
- [x] Run targeted test and relevant plugin-native suite; observe GREEN.

### Task 3: Repository cleanup
- [x] Merge the workflow change after CI verification.
- [x] Verify current plugin/release record remains unchanged.
- [x] Reset obsolete release-only branch refs to current main with force-with-lease.
- [x] Compare each cleaned branch to main and require ahead_by=0.


## Completion evidence
- Regression RED: PR #168 run 41903276410 failed both new release-trigger tests while workflows were dispatch-only.
- Regression GREEN: PR #168 run 41903854242 passed both release-trigger tests; plugin-native and Python/unit suites passed. `integration / livestream-pk` remained the unrelated baseline failure also present on main.
- Merge: PR #168 squash commit `0ee9fba4787f915cc1fa800269ca6c5a5a7f949f`.
- Cleanup: all `release/zodiac-*`, `chore/zodiac-release-record-*`, and the implementation branch were verified to point at the same commit as main after force-with-lease cleanup.
