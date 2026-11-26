# GUI design audit (2026-11-25)

Scope: Quy trình, Giọng đọc, Hình ảnh and Duyệt as driven through the real window with `tools/studio_e2e`.
Status: **first pass by the implementer only.** The structured pass with the Design / VectorLab UI/UX / UI/UX Behaves
skills (plan Task 10, steps 3-4) is waiting for the user to enable those plugins; `frontend-design` is the only design
plugin enabled now.

## Fixed in this run
- High: raw compiler text as build error → plain Vietnamese naming the scene (`build-error.ts`).
- High: scene list duplicated the timeline → removed; preview header names scene and goal.
- Medium: "next step" stated in four places → one in the episode bar; titlebar shortcut no longer repeats the step name.
- Medium: project title three times in the header → once in the selector.
- Medium: step details cut with an ellipsis and a sideways scrollbar → wrap to two lines, no horizontal scroll.
- Medium: agent run looked frozen → attempt/elapsed/scene progress in the step row; per-part list in the agent panel.

## Open (from this session, not yet fixed)
- Medium: scene goals written by older agent runs are partly English; new scene prompts require Vietnamese.
- Medium: the GUI scene preview still hard-cuts between scenes; the page-turn shows in the whole-episode composition (export).
- Low: no per-component override of the `enter` side in the GUI (agent chooses; default is the nearest edge).
- Low: `Chuyển cảnh` slider shows frames and seconds but has no live preview of the turn.

## To run once the plugins are enabled
Capture Quy trình / Giọng đọc / Hình ảnh / Duyệt at 1366x768 and 1060x650; run `design-critique`, `accessibility-review`
and `ui-ux-audit` on them; add findings here with severity and fix the high ones.
