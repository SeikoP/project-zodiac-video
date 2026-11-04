# Zodiac Release Workflow Without Temporary Branches — Design

## Problem
Release helper branches are currently created and pushed only to trigger GitHub Actions. Because those branches contain workflow/release-record commits that are not merged into main, GitHub advertises them as recent branches with “Compare & pull request”. This is repository noise, not unfinished product work.

## Goal
Trigger Zodiac release artifacts from authoritative commits on main, keep manual workflow_dispatch as a fallback, and stop using disposable release branches as an Actions transport.

## Design
1. Plugin archive workflow:
   - keep workflow_dispatch;
   - add push trigger on main, limited to the three plugin version-bearing files;
   - archive bytes come from the merged main commit.
2. Phase bundle workflow:
   - keep workflow_dispatch for one selected phase;
   - add push trigger on main when docs/zodiac-plugin-release.json changes;
   - on push, matrix-build all three phases; on manual dispatch, build only the selected phase.
3. Release sequence:
   - merge plugin version bump → plugin archive workflow runs on main;
   - install/update ChatGPT plugin from that artifact;
   - merge release-record update → phase-bundle workflow runs all three phases on main.
4. Cleanup:
   - after verification, point obsolete release-only branches at current main so they no longer carry unique commits / PR suggestions;
   - do not delete Actions artifacts or alter installed plugin releases.

## Safety
- No approval boundary or Zodiac content/visual behavior changes.
- Existing workflow_dispatch remains available.
- Bundle provenance continues to use the checked-out commit plus docs/zodiac-plugin-release.json.
- No temporary branch is required for future releases.
