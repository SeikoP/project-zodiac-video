# Studio readiness before workbench refactor

Audit: 2026-11-22 Asia/Saigon. Baseline `ffbf815c`, branch `experiment/main-2`; 50 pre-existing dirty/untracked paths preserved. This is source/evidence inspection and planning, not a fresh full E2E.

## E2E

The [native workflow receipt](2026-11-22-studio-workflow-agent-e2e.md), local `gui-evidence.json` and `reopen.json` record real initial agent authoring, one scene edit, eight-scene build, MP4 export/playback and restart playback. Total **833.897s**, reusing existing real WAVs/measured timing; automated playback was muted. That run does not claim fresh TTS/ASR or artistic acceptance.

Artifact existence and SHA-256 were freshly rechecked:

| Local ignored artifact | SHA-256 |
| --- | --- |
| `.runtime/workflow-agent-e2e/episode.mp4` | `012871b8ef9937181f441fe52d8925b9d700e1c9b84306726ae1c14b2962753f` |
| `.runtime/story-visual-cover-repair/r6-final/episode.mp4` | `658f33ec6791e9429b27cd70dc0b39d1dfe26345c0dc6a735e17546dbc67895e` |

The [newer revision-6 report](2026-11-22-story-visual-finalization.md) records full decode, 74.4s 1080×1920 H.264/AAC, 38 caption cues and corrected cover. Its QA JSON was inspected; decoding/pixel checks were not rerun here. Newer media export does not establish full native GUI acceptance of current dirty sources. Human voice/visual/video gates remain PENDING.

Fresh audit check: `python -m unittest tests.test_studio_agent_authoring tests.test_studio_p1_agent tests.test_studio_p5_transport -q`: **22 tests passed in 25.278s**. Protocol fixtures are not live model inference. Full repo tests/remote CI were not run for this docs-only task.

## Agent

Current files inspected: `agent_bridge.py`, `agent_authoring.py`, `visual_workspace.py`, `rpc_stdio.py`, frontend `backend.ts` and Rust method allowlist. CodeGraph belongs to another checkout, so current worktree source is authoritative.

```text
React → Tauri allowlist → Python RPC / Project Core
  → AgentManager → local codex app-server --stdio
  → JSON proposal → validation → confirmed canonical apply
  → scene.compile / episode.build → HyperFrames preview/export
```

Worker uses ephemeral read-only threads and temporary isolated CODEX_HOME with existing login, without inheriting MCP/plugins/hooks. Initial authoring receives verified narration ranges, narrative plan, measured timing, schema and component/prop metadata. Scene editing receives scene plus precomputed candidate bundles. Prompts prohibit tools/files and inbound interaction requests are rejected. Studio invokes resource/build tools; the model currently proposes JSON rather than dynamically calling those tools.

Implemented proposals: project note, initial source only when none exists, scene transform/asset/performance edits. Explicit apply checks revision/source/voice dependencies and uses canonical history. Agent never grants human approval. `agent.health` still describes only inspection/project.note: that scope string is outdated. `available` checks executable presence, not live authentication/model readiness.

This audit verified Codex executable and login-file presence without reading/printing credentials. No new inference request: current quota/network/model readiness remains unverified.

## Resources

Authoritative V4 catalog provides actual SVG props and body/hair/outfit/pose/expression metadata. Python/native/UI expose `assets.describe`, `assets.gallery`, `assets.find_candidates`. Scene-agent startup calls candidates with default constraints and injects bundles; it does not repeatedly browse images/search/generate artwork. Candidate service supports context/family/model/view/asset/role/contact and source-backed technical usage. Reviewed/model-level usage remains incomplete; history scans at most 500 projects/50 records and gallery rebuilds its projection rather than maintaining an incremental index.

Current V5 export is approved-voice-only. BGM/SFX inputs are unsupported and must not silently disappear. New series-topic opening is narrower than arbitrary legacy Remotion designed-cover compatibility.

## Roadmap mapping

| Phase | Evidence-backed state | Remaining |
| --- | --- | --- |
| P0 Foundation | Implemented per roadmap | Preserve contracts/evidence |
| P1 Shell/agent | Real bounded native agent demonstrated | Editor-first usability; accurate capability/health reporting |
| P2 Voice | Real TTS/ASR recorded separately; repair E2E reused voice | Genuine listening acceptance; regression after new GUI |
| P3 Compiler | Technical eight-scene/incremental build recorded | Current-change regression; source/cache invariants |
| P4 Editor | Scene edits and preview demonstrated | Unified episode timeline/context; latest native regression; art gate not implied |
| P5 Gallery/factory | Partial gallery/palette/performance/usage slices | Reviewed palettes/phone geometry/contact; meme composition previews; reviewed reuse; incremental index |
| P6 Concepts/media/audio/packages | Partial Ideas/progress/local MP4 review | Complete evidence-bound library/packages, licensed playable audio, safe archive/restore |
| P7 E2E/export/mix | Partial real MP4/sidecars and older native acceptance | Latest native E2E; Audio Mix V2/SFX/ducking/rights; audio-only remux; final human review; legacy compatibility |

P5/P6/P7 remain open. Technical output does not close their quality requirements.

## Next

Review [design](../superpowers/specs/2026-11-22-studio-editing-workbench-design.md) and [plan](../superpowers/plans/2026-11-22-studio-editing-workbench.md), resolve trimming/reorder before code. Keep audio/tool-loop follow-ups separate. No release/publication or approval follows from this audit.
