# Phase 02 regression repair Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan natively.

**Goal:** Add cafe accents and prevent the observed Phase 02 contract, backdrop and preview failures.

**Architecture:** Keep native phase order and review gates. Require selected accents or an explicit omission in the existing art-direction gate; derive default accent positions from transformed wall coordinates. Preserve explicit transforms and canonical source hashes.

**Tech Stack:** Node.js ESM, native SVG, node:test, GitHub Git data API.

**Spec:** User approved script and foreground corrections in this conversation.

## Global Constraints

- Approved narration SHA256 132e2c307c5b8e1b89a9b95b820f0d3350393a357e457924a5247cf118fd8595.
- Scene-set stays behind independently composed actors. Only accents are wall-contained.
- GitHub first; no ChatGPT plugin publication.
- No automatic decorations; an empty accent list needs a recorded omission reason.

## Review Focus

- Resizing backdrops must keep default accents within the transformed wall.
- Explicit out-of-wall transforms must fail, not silently be resized.
- Current native contract must pass; retired recipe matrices must not return.
- Scene-complete and event SVG roots must receive identical size attributes.
- Recompilation must preserve actor coordinates and avoid duplicate accents.

## Tasks

- [x] Add failing tests for explicit accent decisions, transformed-wall placement, hashes, foreground independence and scene-frame SVG sizing.
- [x] Fix native validators/compiler, carry verified existing repairs and update current selection guidance.
- [x] Run regression and related tests; run native Song Tu Phase 02 and inspect corrected SVG endpoints.
- [ ] Commit tested source to current GitHub main with an expected-head lease, preserve other repository files and leave installed plugin unchanged.
