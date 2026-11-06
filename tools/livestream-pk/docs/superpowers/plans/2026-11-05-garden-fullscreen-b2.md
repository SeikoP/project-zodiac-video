> **Lưu ý phiên bản (2026-11-05):** Các mốc 48 chậu, cấu hình zoom/camera trước đây và hướng dẫn OBS trong tài liệu lịch sử không còn là cấu hình vận hành chuẩn. Garden hiện là 42 chậu và dùng TikTok LIVE Studio. Tra cứu [Garden Integration](../../../garden/INTEGRATION.md) hoặc `garden/INTEGRATION.md` tại thư mục `tools/livestream-pk` để xem quy tắc hiện tại. Tài liệu này được giữ để đối chiếu yêu cầu, không áp dụng nguyên xi khi triển khai.
# Garden Full-screen B2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the narrow 16-shelf Garden tower with one full-screen two-wing rack while keeping one 96-seat Seed Zone and using viewer names instead of public slot codes.

**Architecture:** Keep logical slots 0–95 unchanged. Map logical rows 0–7 to the left visual wing and rows 8–15 to the right visual wing; both wings render inside one greenhouse frame. Camera bounds derive from the full two-wing structure, and label policy stays screen-space/adaptive.

**Tech Stack:** Node.js ESM, Canvas 2D browser renderer, node:test, GitHub Actions.

**Spec:** `tools/livestream-pk/docs/superpowers/specs/2026-11-05-garden-fullscreen-b2-addendum.md`

## Global Constraints

- One logical Seed Zone only: `cloud-1`.
- 96 active seats; six pots per shelf.
- Two visual wings × eight shelves × six pots.
- Existing `plotId` and seat assignments remain stable.
- Overview shows nickname, not `#slot`.
- Focus information remains screen-space above shelf fronts.
- No changes to growth, heart rotation, rewards, save schema, or gameplay mechanics in this patch.

## Review Focus

- 96-player geometry: no pot or label overlap across the center gap.
- 12-player geometry: balanced seat order still visibly spans the garden rather than clustering one wing.
- Long/non-Latin nicknames: truncation must not fall back to slot numbers or overflow the per-pot label width.
- Overview camera safe area: full rack visible below top HUD and above feed region.
- Existing save slots: remapping is visual only; no migration or seat reassignment.

---

### Task 1: Two-wing geometry and camera bounds

**Files:**
- Modify: `tools/livestream-pk/garden/config.mjs`
- Modify: `tools/livestream-pk/garden/world.mjs`
- Modify: `tools/livestream-pk/public/garden/view.js`
- Modify: `tools/livestream-pk/garden/world.test.mjs`
- Modify: `tools/livestream-pk/garden/view.test.mjs`
- Modify: `tools/livestream-pk/garden/camera.mjs`
- Modify: `tools/livestream-pk/garden/camera.test.mjs`

**Interfaces:**
- Produces: `rackWings=2`, `shelvesPerWing=8`, `rackWingGapX`, and physical slot layout where `row` is 0–7 within a wing.
- Consumes: stable logical `slot` values and existing camera zoom settings.

- [ ] Write failing tests asserting slot 0/47 are left wing, 48/95 right wing, six-pot spacing, and full overview span.
- [ ] Run Garden geometry/camera tests and confirm failures are caused by current single-column layout.
- [ ] Implement minimal geometry/config/camera changes.
- [ ] Run the same tests and confirm pass.
- [ ] Commit.

### Task 2: Adaptive nickname labels, no public slot codes

**Files:**
- Modify: `tools/livestream-pk/public/garden/view.js`
- Modify: `tools/livestream-pk/public/garden/garden.js`
- Modify: `tools/livestream-pk/garden/view.test.mjs`

**Interfaces:**
- Produces: `displayNickname(nickname, zoom)` returning bounded viewer-facing identity text.
- Consumes: current camera zoom and owner nickname.

- [ ] Write failing tests for dense, normal, focused and Unicode nicknames; assert no `#012` fallback.
- [ ] Run view tests and confirm missing helper/old behavior fails.
- [ ] Implement helper and wire renderer labels/join notices to names only.
- [ ] Run view tests and confirm pass.
- [ ] Commit.

### Task 3: One greenhouse frame with two visual wings

**Files:**
- Modify: `tools/livestream-pk/public/garden/garden.js`
- Modify: `tools/livestream-pk/public/garden/garden.css`
- Test: `tools/livestream-pk/garden/view.test.mjs` and syntax/simulator suite.

**Interfaces:**
- Consumes: Task 1 geometry.
- Produces: one outer greenhouse frame, two shelf runs per visual row group, no module/wing labels.

- [ ] Add/extend pure geometry assertions that frame bounds cover both wings and center gap.
- [ ] Verify RED against current renderer assumptions.
- [ ] Render outer frame once, draw eight shelves in each wing, keep shelf fronts behind screen-space labels.
- [ ] Run Garden/view/simulator syntax tests.
- [ ] Commit.

### Task 4: Full regression verification

**Files:** no production changes unless a regression is found.

- [ ] Run repository livestream test suite in CI.
- [ ] Confirm no Garden-specific failures; report the known `quick-room.test.mjs` baseline separately if still present.
- [ ] Inspect 12/24/48/96 simulator screenshots when a runnable browser host is available; do not claim visual acceptance without that evidence.
