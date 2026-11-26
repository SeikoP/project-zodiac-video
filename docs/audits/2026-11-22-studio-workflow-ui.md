# Studio grouped workflow UI

Task 2 of [the approved plan](../superpowers/plans/2026-11-20-studio-workflow-agent.md)
is technically complete. The primary navigation is Kế hoạch, Episode and Tài
nguyên. Episode groups Tổng quan, Giọng đọc, Hình ảnh and Xuất & duyệt, with
contextual Agent/ Nhật ký actions and one shared episode selector.

Voice/visual components retain selections and task state across sub-tab switches.
Hidden media pause; hidden workspaces stop polling. Slow reads cannot enqueue
overlapping refreshes. This resolves an actual native queue buildup: a cold real
Voice Lab snapshot took 25.454s while the old UI kept queuing reads every 1.5s.
The cold analysis itself remains a measured performance limitation, not an
instantaneous-load claim. The next action uses actual build readiness without
promoting human approval. The old hardcoded Phase 3+4 meter is removed.

Initial and scene proposals are readable before application; full task detail
remains available. Confirmed edits show their applied command ID. The existing
asset/idea screens are reused. Export progress, the actual episode MP4 and manual
concept/sign review are together. Users can return from a separately opened MP4
to the episode export; a new export does not invalidate the local player's readiness.

Verification:

- `pnpm --dir apps/zodiac-studio exec tsc --noEmit`: PASS.
- `tests/studio_compact_layout.mjs`: PASS at 1366×768, 1060×650 and 1093×614;
  navigation, next action, source pagination, preserved selection, slow-read
  backpressure and stopped hidden polling. Log `.runtime/workflow-agent-e2e/layout-final.log`.
- `tests/studio_ideas_browser.mjs`: PASS; compact/expanded library/review,
  dynamic catalog, playback, failure recovery and explicit fixture-only approval.
- `tests/studio_p5_gallery_browser.mjs`: PASS; pagination, filtering, preview,
  palettes and read-only history at the three sizes.
- `tests/studio_hyperframes_export_browser.mjs`: PASS; progress, actual fixture
  MP4 decode, stale output, local-player readiness and return to episode output.
- Independent review identified the local-player reset bug and confirmed its fix.

Browser fixtures above prove presentation/interaction only. The separate
`tests/studio_workflow_native.mjs` run uses the actual Tauri/Rust/Python transport,
real agent tasks and a new persistent MP4; its receipt is recorded separately.
Human listening, acting and final quality approval remain PENDING. No release,
installer or production merge is included.
