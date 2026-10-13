# Current production test migration

Historical tests of deleted room profiles, character masters, face/outfit/accessory/effect choices and old scene-set APIs are superseded by current-asset-surface, minimal-character-library, supporting-backdrop, meme-props, asset-agent-e2e and backdrop-integrity tests. The original contracts remain in Git history; no skipped failing tests or compatibility assets are reintroduced.

Removed test files:
- bedroom-v153-wiring.test.mjs
- female-clean-bun.test.mjs
- female-extension-visual-quality.test.mjs
- effect-lifecycle.test.mjs
- effect-semantic-families.test.mjs
- outfit-pattern-wiring.test.mjs
- asset-showcase-preview.test.mjs
- environment-composition-wiring.test.mjs
- asset-selection-policy.test.mjs
- classroom-caption-safety.test.mjs
- scene-set-identity.test.mjs
- scene-set-regressions.test.mjs

The historical approved-Gemini replay fixture uses removed identities and room profiles; its producer replay test is superseded by the current synthetic native asset-agent-e2e test. Runner compatibility tests for historical imports remain active.
