# Producer/renderer parity — technical evidence

Producer fresh taxonomy projects to the existing Job@5 IR (unchanged canonical schema hash): Narrative Visual → `story_object`; Scene Accent → `environment/background` with `role=scene_accent`; physical prop → `interactive_prop`; effect remains `effect`.

Renderer checks density by co-visible event state (not total authored entities), has a separate Narrative Visual count, validates story visuals against caption, and checks caption collision for background-layered Scene Accents frame-by-frame.

Source tests: `runtime/zodiac-renderer/2.0.1/renderer/tests/prepare.test.mjs`, `spatial-layout.test.mjs`; producer tests `fresh-narrative-visual.test.mjs`, `canvas-accent-regression.test.mjs`.

Latest **code-level CI** on synchronized Phase 2 revision: https://github.com/SeikoP/project-zodiac-video/actions/runs/38436864893 (SUCCESS). Subsequent accent-relative-position changes need their own CI result.

Missing: actual frame pixel capture across first/event/mid/final frames and native preview comparison; full Job@5 → local Studio → video/audio acceptance. These are not equivalent to passing spatial geometry tests.
