# Nhân Mã GUI e2e from scratch — findings and fixes (2026-11-25)

Run: real Tauri app (prebuilt debug exe + Vite), fresh projects store, WebView2 CDP port 9227, real
`love-sincere-nhan-ma-phase1-handoff-v7.zip` imported through the native file dialog. No human gate was
clicked (voice listening, visual review, export approval stay PENDING). Cargo could not rebuild the host
here (no Windows SDK `kernel32.lib`), so the existing exe was used; only Python/TS changed.

## Measured timeline (before fixes)
| Step | Time | Note |
|---|---|---|
| Import zip | ~3 s | fine |
| Generate voice (32 units, VieNeu) | ~95 s | sequential ~3 s/unit; UI showed `0/32` the whole time |
| Assemble | ~7 s | needs a **second** "Chạy" click, not explained |
| ASR timing | **~190 s** (170 s at `0/32`) | 32 Whisper calls, each ~7.5 s for 1–3 s of audio, 4 workers fighting for 8 cores |
| Agent authoring | 103 s (OK) / 207 s (failed, 2 repair attempts) | |
| Build (8 scenes) | ~1.4 s | fine |
| `pipeline.get` poll | 1.9–2.9 s each | re-hashed every take on every call |

## Hard-to-use points found, and what was done
1. **Voice step needs two identical clicks** (generate, then assemble). Detail now says
   "… còn ghép audio, bấm Chạy lần nữa". (`pipeline/derive.py`)
2. **No progress while voice runs** (`0/32` until the end). A monitor now reports finished WAVs; the step shows
   "Đang chạy 9/32" and the Voice Lab "Đang tạo giọng đọc: 9/32". (`voice_lab.py`, `derive.py`, `evidence.py`)
3. **Agent run started from the step list was invisible in the right panel** (no Stop, no progress, button
   enabled). The editor now follows the run. (`VisualEditor.tsx`, `EpisodeShell.tsx`)
4. **Agent failure vanished after one poll** (step flipped back to "Sẵn sàng"). Failure is kept until the node
   runs again, first line of the error only. (`pipeline/agent_runs.py`)
5. **"Kiểm tra bản soạn" looked like it did nothing.** It now shows "Lỗi · N vấn đề cần sửa, mở bước này để xem"
   (report bound to the source hash). (`validators.py`, `evidence.py`)
6. Misleading "Nguồn hoặc giọng đã đổi" on a built video whose real blocker is the failed checks step; now
   "Đã dựng nhưng bước trước chưa đạt: Kiểm tra bản soạn". (`derive.py`)
7. Eight identical "Cảnh" rows → "Cảnh s01…"; the scene group is collapsed unless running/failed/selected so
   "Xuất MP4" is not pushed out of view. (`derive.py`, `StepList.tsx`)
8. English job text in the Voice Lab ("Preparing audio", "Audio ready — …") translated; dropdown no longer
   shows the sign twice ("Nhân Mã · Nhân Mã bảo …"). (`VoiceLab.tsx`, `studio-navigation.tsx`)

## Backend bottlenecks fixed
- **ASR timing 190 s → ~36 s** (same words, max start/end drift ≤ 260 ms vs the per-clip run). Whisper encodes a
  fixed window per call, so units are now heard together (≤ 24 s per pass, greedy decoding) and each unit is still
  verified against its approved text; a unit that cannot be proven is heard alone as before. 2 workers beat 4
  (36 s vs 47 s) because the work is CPU-bound. (`voice_worker.py` `BatchedWordSource`, `zodiac_local._transcribe_raw_words`,
  `timing._align_cached_scenes(word_source=)`)
- **`pipeline.get` ~1.1 s → ~0.5 s warm**: `voice_evidence` re-hashed 32 takes + assembly six times per call; it is
  now cached on a stat signature (size + mtime of every file it depends on) and fully re-verified when any changes.

## Open — needs a decision (not changed)
- **`checks` step: `experience_profile` now authored (done), but the step still cannot pass.** The agent capsule
  (`agent_authoring.EXPERIENCE_PROFILE_RULE`) now requires `experience_profile` on every scene (plugin Phase 2 rule:
  `story_mode`, `story_focus`, links). Verified: the field survives confirmed apply, the plugin compiler strips it
  (production output identical, only the source hash differs), and `scene-experience` accepts it. Not yet verified: a
  fresh agent run actually satisfying it (needs a new authoring run, ~2-4 min). Still blocking:
  `progressive-preflight` and `authoring-completeness` need `production.json` + `design.md` (Remotion-era files Studio
  never writes). **Done:** in a Studio workspace (has `studio-import-receipt.json`) a validator whose only missing inputs
  are those two files reports SKIPPED and does not fail the report (`validators_bridge.mjs`, `validators.py`); any other
  missing input still BLOCKS. The existing project now gets: preflight SKIPPED, authoring-completeness SKIPPED,
  story-visual-presence as before, scene-experience REVIEW until the agent authors profiles. Whether `checks` then
  passes depends on a fresh authoring run; not yet run.
- `derive` lets Soạn hình ảnh become READY while "Nghe và duyệt giọng" is still awaiting the user (legacy
  allowance: timing was measured from Voice Lab). The README says voice must be approved before building.
- The same "next step" is stated in four places (title bar, episode bar, step row, right panel).
- TTS is sequential (~3 s/unit); a persistent engine/batch would be the next lever.

## Verification
Python: 208 passed (voice lab, service, rpc, pipeline, timing, p34 visual) before the last two edits, then
165 passed (pipeline + voice lab) after them; new tests `test_voice_worker_batch.py`,
`test_studio_pipeline_agent_runs.py`, derive/voice-lab additions. Node: `studio_pipeline_layout` + `studio_episode_timeline`
15/15. `tsc --noEmit` clean. Browser (Playwright) suites not run (no Playwright module here). Live: fixes 3, 4, 5, 6,
7, 8 observed in the running app via HMR/backend restart; the ASR change was measured through the same worker entry
point, not re-run in the GUI.

## Follow-up run (same day): autopilot repair through the GUI
Real-mouse clicks on the running app, fresh store, xhigh kept. Result: **"Kiểm tra bản soạn" passed** after the agent
repaired the existing Visual Intent in 2 autopilot attempts (~3-4 min each).
Root causes found on the way:
- `proposals._intent_issues` flagged every character state (`neutral`, `reaction`…) as `PROPOSAL_ASSET_DANGLING`, so a
  repaired proposal was never applied; now cast states are recognised.
- Autopilot had no repair agent for `checks`; it now re-authors the existing intent (`capsule(repair=True)`, same
  retry contract) with hints for the three real issue codes.
- The agent was never told to author event `action` (needed by `character_action`), to add `depth__*` set dressing, or
  that `scene_set_id` is retired for fresh scenes; the schema now says so. Core also binds `story_visual_decision` and
  rejects unknown expression/pose ids with the valid list.
- Agent: xhigh, 600 s budget, first answer + 2 repairs; step list shows attempt and elapsed minutes.
Still open: autopilot now stops at "Tài nguyên" (`PIPELINE_AGENT_UNSUPPORTED`): no Studio agent for assets, cover,
publish or inspect, and the two human gates (voice listening, visual review) remain PENDING.

## Follow-up 2: graph now runs to the human review gate
Assets, cover, publish and inspect have no model task in Studio, so they are deterministic drafts
(`pipeline/drafts.py`) validated and receipted through the same proposal path (cover from the authored opening topic,
publish copy from sign/premise/goals, structural inspect report from the build QA, assets receipt once every library
reference resolves). Both the Chạy button and autopilot use them; they are advisory evidence only.
Live (real clicks, Tự động): checks → assets → cover → publish → scenes → build → inspect all Xong; autopilot stopped at
"Duyệt hình ảnh" (19/21 steps). Voice listening in this store is recorded as `user_listened` by the app (not by this
automation); visual review and export approval remain PENDING for the user.
Publish copy is a plain draft, not final marketing copy; edit before use.

## Follow-up 3: scene-by-scene authoring, no scene list, style stated
- **Scene list removed** from the visual editor (it duplicated the timeline). Scenes are picked on the timeline; the preview
  header now reads "Xem trước · Cảnh 3/8" plus the scene goal. The two browser tests now click the timeline.
- **Authoring is per scene** (`agent_parts.py`, `AgentManager.start_authoring_scenes`): one skeleton agent (cast, cover,
  story visuals), then one small task per scene, **2 agents in parallel**; Core merges, validates the whole episode with the
  compiler and redoes only the scenes the validator names (up to 2 rounds). Core owns deterministic fields (scene ids,
  narration ranges, asset-key prefixes, canonical visual_role, story_visual_decision). Per-scene checks catch the mistakes seen
  in real runs before the merge: layer must be an integer, anchors must be verbatim, action and experience_profile required.
  The compiler now appends `[scene sNN]` to its validation errors so a failure can be attributed.
  Measured on the real app: skeleton ~35 s, each scene 25-55 s, whole episode ~3 min (vs 6+ min in one turn).
- **Animation style stated to the agent and in the GUI:** limited 2D cut-out (3 beats per scene, hard-cut swaps, at least one
  lean/recoil/pull-with-prop move per scene, big characters); shown as "Phong cách" in the agent panel; the agent panel lists
  each part with status and seconds. The style itself is the one already approved in
  `docs/superpowers/specs/2026-11-25-limited-2d-cutout-style.md`.
